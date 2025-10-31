import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Checkbox,
	Code,
	Collapse,
	Group,
	Menu,
	Modal,
	NumberInput,
	Paper,
	ScrollArea,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconChevronRight, IconChevronUp, IconFolder, IconPlus, IconPlusMinus } from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { parseAsInteger } from "nuqs/server";
import { useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateGradebookCategory,
	tryGetNextSortOrder,
} from "server/internal/gradebook-category-management";
import {
	tryCreateGradebookItem,
	tryGetNextItemSortOrder,
} from "server/internal/gradebook-item-management";
import { tryFindGradebookByCourseId } from "server/internal/gradebook-management";
import { ContentType, getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, BadRequestResponse, ForbiddenResponse, ok } from "~/utils/responses";
import { z } from "zod";
import type { Route } from "./+types/course.$id.grades";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const courseContext = context.get(courseContextKey);

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new BadRequestResponse("Invalid course ID");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}


	const gradebookSetupForUI = courseContext.gradebookSetupForUI;

	return {
		course: courseContext.course,
		gradebook: courseContext.gradebook,
		gradebookJson: courseContext.gradebookJson,
		gradebookYaml: courseContext.gradebookYaml,
		gradebookSetupForUI,
		flattenedCategories: courseContext.flattenedCategories,
		enrollments: courseContext.course.enrollments.filter(
			(e) => e.status === "active",
		),
		hasExtraCredit: gradebookSetupForUI ? (gradebookSetupForUI.totals.calculatedTotal > 100 || gradebookSetupForUI.extraCreditItems.length > 0) : false,
		displayTotal: gradebookSetupForUI?.totals.calculatedTotal ?? 0,
		extraCreditItems: gradebookSetupForUI?.extraCreditItems ?? [],
		totalMaxGrade: gradebookSetupForUI?.totals.totalMaxGrade ?? 0,
	}
};

const createItemSchema = z.object({
	intent: z.literal("create-item"),
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	categoryId: z.coerce.number().optional().nullable(),
	maxGrade: z.coerce.number().optional(),
	minGrade: z.coerce.number().optional(),
	weight: z.coerce.number().optional(),
	extraCredit: z.boolean().optional(),
});

const createCategorySchema = z.object({
	intent: z.literal("create-category"),
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	parentId: z.coerce.number().optional().nullable(),
	weight: z.coerce.number().optional(),
});

const inputSchema = z.discriminatedUnion("intent", [
	createItemSchema,
	createCategorySchema,
]);

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({ error: "Unauthorized" });
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({ error: "Invalid course ID" });
	}

	// Get gradebook for this course
	const gradebookResult = await tryFindGradebookByCourseId(payload, courseId);
	if (!gradebookResult.ok) {
		return badRequest({ error: "Gradebook not found for this course" });
	}

	const gradebook = gradebookResult.value;
	const gradebookId = gradebook.id;

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = inputSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	if (parsedData.data.intent === "create-item") {
		// Get next sort order
		const sortOrderResult = await tryGetNextItemSortOrder(
			payload,
			gradebookId,
			parsedData.data.categoryId ?? null,
		);

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const sortOrder = sortOrderResult.value;

		// Create gradebook item
		const createResult = await tryCreateGradebookItem(
			payload,
			request,
			{
				gradebookId,
				categoryId: parsedData.data.categoryId ?? null,
				name: parsedData.data.name,
				description: parsedData.data.description,
				maxGrade: parsedData.data.maxGrade,
				minGrade: parsedData.data.minGrade,
				weight: parsedData.data.weight,
				extraCredit: parsedData.data.extraCredit ?? false,
				sortOrder,
			},
		);

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return ok({ success: true, message: "Gradebook item created successfully" });
	}

	if (parsedData.data.intent === "create-category") {
		// Get next sort order
		const sortOrderResult = await tryGetNextSortOrder(
			payload,
			gradebookId,
			parsedData.data.parentId ?? null,
		);

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const sortOrder = sortOrderResult.value;

		// Create gradebook category
		const createResult = await tryCreateGradebookCategory(
			payload,
			request,
			{
				gradebookId,
				parentId: parsedData.data.parentId ?? null,
				name: parsedData.data.name,
				description: parsedData.data.description,
				weight: parsedData.data.weight,
				sortOrder,
			},
		);


		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}
		return ok({ success: true, message: "Gradebook category created successfully" });
	}

	return badRequest({ error: "Invalid intent" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData && "success" in actionData && actionData.success) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	} else if (actionData && "error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

// ============================================================================
// Hooks
// ============================================================================

export function useCreateGradeItem() {
	const fetcher = useFetcher<typeof clientAction>();

	const createGradeItem = (values: {
		name: string;
		description?: string;
		categoryId?: number | null;
		maxGrade?: number;
		minGrade?: number;
		weight?: number;
		extraCredit?: boolean;
	}) => {
		const submissionData = {
			intent: "create-item" as const,
			...values,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
		});
	};

	return {
		createGradeItem,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateCategory() {
	const fetcher = useFetcher<typeof clientAction>();

	const createCategory = (values: {
		name: string;
		description?: string;
		parentId?: number | null;
		weight?: number;
	}) => {
		const submissionData = {
			intent: "create-category" as const,
			...values,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
		});
	};

	return {
		createCategory,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

// ============================================================================
// Weight Display Component
// ============================================================================

function WeightDisplay({
	weight,
	adjustedWeight,
	extraCredit,
}: {
	weight: number | null;
	adjustedWeight: number | null;
	extraCredit?: boolean;
}) {
	const hasWeight = weight !== null;
	const hasAdjustedWeight = adjustedWeight !== null;
	const weightsMatch =
		hasWeight && hasAdjustedWeight && Math.abs(weight - adjustedWeight) < 0.01;

	let displayText: string;
	let tooltipContent: React.ReactNode;

	if (hasWeight && hasAdjustedWeight) {
		if (weightsMatch) {
			displayText = `${weight}%`;
			tooltipContent = (
				<Stack gap="xs">
					<div>
						<Text size="xs" fw={700}>
							Specified weight: {weight}%
						</Text>
					</div>
					<div>
						<Text size="xs">
							Adjusted weight: {adjustedWeight.toFixed(2)}%
						</Text>
					</div>
				</Stack>
			);
		} else {
			displayText = `${weight}% (${Math.round(adjustedWeight)}%)`;
			tooltipContent = (
				<Stack gap="xs">
					<div>
						<Text size="xs" fw={700}>
							Specified weight: {weight}%
						</Text>
					</div>
					<div>
						<Text size="xs">
							Adjusted weight: {adjustedWeight.toFixed(2)}%
						</Text>
					</div>
					<div>
						<Text size="xs">
							The adjusted weight is different from the specified weight because
							weights are distributed to sum to 100% at this level.
						</Text>
					</div>
				</Stack>
			);
		}
	} else if (!hasWeight && hasAdjustedWeight) {
		displayText = `- (${Math.round(adjustedWeight)}%)`;
		tooltipContent = (
			<Stack gap="xs">
				<div>
					<Text size="xs" fw={700}>
						No weight specified
					</Text>
				</div>
				<div>
					<Text size="xs">
						Adjusted weight: {adjustedWeight.toFixed(2)}%
					</Text>
				</div>
				<div>
					<Text size="xs">
						This weight was automatically calculated to ensure all weights sum
						to 100% at this level.
					</Text>
				</div>
			</Stack>
		);
	} else {
		displayText = "-";
		tooltipContent = (
			<Stack gap="xs">
				<div>
					<Text size="xs">No weight specified</Text>
				</div>
				<div>
					<Text size="xs">No adjusted weight calculated</Text>
				</div>
			</Stack>
		);
	}

	// Build the weight display content
	const weightContent = (
		<Group gap={4} align="center" wrap="nowrap">
			<Text size="sm">{displayText}</Text>
			{extraCredit && (
				<Tooltip
					label={
						<Stack gap="xs">
							<Text size="xs" fw={700}>
								Extra Credit
							</Text>
							<Text size="xs">
								This item is marked as extra credit. Extra credit items do not
								participate in weight distribution and allow categories to total
								above 100%.
							</Text>
						</Stack>
					}
					withArrow
					multiline
					w={300}
				>
					<IconPlusMinus size={16} style={{ cursor: "help" }} />
				</Tooltip>
			)}
		</Group>
	);

	// Always show tooltip if adjusted weight exists and is different from weight
	if (hasAdjustedWeight && (!hasWeight || !weightsMatch)) {
		return (
			<Tooltip label={tooltipContent} withArrow multiline w={300}>
				<Box style={{ cursor: "help" }}>{weightContent}</Box>
			</Tooltip>
		);
	}

	return weightContent;
}

function OverallWeightDisplay({
	overallWeight,
	weightExplanation,
}: {
	overallWeight: number | null;
	weightExplanation: string | null;
}) {
	if (overallWeight === null) {
		return <Text size="sm">-</Text>;
	}

	return (
		<Tooltip
			label={
				<Stack gap="xs">
					<div>
						<Text size="xs" fw={700}>
							Overall weight: {overallWeight.toFixed(2)}% of course
						</Text>
					</div>
					{weightExplanation ? (
						<div>
							<Text size="xs" fw={700} mb={4}>
								Calculation:
							</Text>
							<Text size="xs">{weightExplanation}</Text>
						</div>
					) : (
						<Text size="xs">
							This is the effective weight of this item in the overall course
							grade calculation.
						</Text>
					)}
				</Stack>
			}
			withArrow
			multiline
			w={400}
		>
			<Text size="sm" style={{ cursor: "help" }}>
				{overallWeight.toFixed(2)}%
			</Text>
		</Tooltip>
	);
}

// ============================================================================
// Modal Components
// ============================================================================

function CreateGradeItemModal({
	opened,
	onClose,
	categoryOptions,
}: {
	opened: boolean;
	onClose: () => void;
	categoryOptions: Array<{ value: string; label: string }>;
}) {
	const { createGradeItem, isLoading } = useCreateGradeItem();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: "",
			description: "",
			category: "",
			maxGrade: "",
			minGrade: "",
			weight: "",
			extraCredit: false,
		},
		validate: {
			name: (value) => (!value || value.trim().length === 0 ? "Name is required" : null),
		},
	});

	const handleSubmit = form.onSubmit((values) => {
		const categoryId = values.category ? Number.parseInt(values.category, 10) : null;
		createGradeItem({
			name: values.name,
			description: values.description || undefined,
			categoryId: categoryId && !Number.isNaN(categoryId) ? categoryId : null,
			maxGrade: values.maxGrade ? Number.parseFloat(values.maxGrade) : undefined,
			minGrade: values.minGrade ? Number.parseFloat(values.minGrade) : undefined,
			weight: values.weight ? Number.parseFloat(values.weight) : undefined,
			extraCredit: values.extraCredit,
		});
		form.reset();
		onClose();
	});

	return (
		<Modal opened={opened} onClose={onClose} title="Create Grade Item" centered>
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label="Name"
						required
						placeholder="Enter item name"
					/>

					<Textarea
						{...form.getInputProps("description")}
						key={form.key("description")}
						label="Description"
						placeholder="Enter description (optional)"
						minRows={3}
					/>

					<Select
						{...form.getInputProps("category")}
						key={form.key("category")}
						label="Category"
						placeholder="Select category (optional)"
						data={categoryOptions}
						clearable
					/>

					<NumberInput
						{...form.getInputProps("maxGrade")}
						key={form.key("maxGrade")}
						label="Max Grade"
						placeholder="Enter max grade (optional)"
						min={0}
					/>

					<NumberInput
						{...form.getInputProps("minGrade")}
						key={form.key("minGrade")}
						label="Min Grade"
						placeholder="Enter min grade (optional)"
						min={0}
					/>

					<NumberInput
						{...form.getInputProps("weight")}
						key={form.key("weight")}
						label="Weight (%)"
						placeholder="Enter weight (optional)"
						min={0}
						max={100}
					/>

					<Checkbox
						{...form.getInputProps("extraCredit", { type: "checkbox" })}
						key={form.key("extraCredit")}
						label="Extra Credit"
					/>

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" loading={isLoading}>
							Create
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}

function CreateCategoryModal({
	opened,
	onClose,
	parentOptions,
}: {
	opened: boolean;
	onClose: () => void;
	parentOptions: Array<{ value: string; label: string }>;
}) {
	const { createCategory, isLoading } = useCreateCategory();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: "",
			description: "",
			parent: "",
			weight: "",
		},
		validate: {
			name: (value) => (!value || value.trim().length === 0 ? "Name is required" : null),
		},
	});

	const handleSubmit = form.onSubmit((values) => {
		const parentId = values.parent ? Number.parseInt(values.parent, 10) : null;
		createCategory({
			name: values.name,
			description: values.description || undefined,
			parentId: parentId && !Number.isNaN(parentId) ? parentId : null,
			weight: values.weight ? Number.parseFloat(values.weight) : undefined,
		});
		form.reset();
		onClose();
	});

	return (
		<Modal opened={opened} onClose={onClose} title="Create Category" centered>
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label="Name"
						required
						placeholder="Enter category name"
					/>

					<Textarea
						{...form.getInputProps("description")}
						key={form.key("description")}
						label="Description"
						placeholder="Enter description (optional)"
						minRows={3}
					/>

					<Select
						{...form.getInputProps("parent")}
						key={form.key("parent")}
						label="Parent Category"
						placeholder="Select parent category (optional)"
						data={parentOptions}
						clearable
					/>

					<NumberInput
						{...form.getInputProps("weight")}
						key={form.key("weight")}
						label="Weight (%)"
						placeholder="Enter weight (optional)"
						min={0}
						max={100}
					/>

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" loading={isLoading}>
							Create
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}

function GraderReportView({
	loaderData,
}: {
	loaderData: Route.ComponentProps["loaderData"];
}) {
	const { enrollments, gradebookJson } = loaderData;

	if (!gradebookJson) {
		return (
			<Paper withBorder p="xl">
				<Text c="dimmed" ta="center">
					No gradebook has been set up for this course yet.
				</Text>
			</Paper>
		);
	}

	const { gradebook_setup } = gradebookJson;

	// Flatten items for column headers
	const allItems: Array<{
		id: number;
		name: string;
		type: string;
		maxGrade: number | null;
	}> = [];

	for (const item of gradebook_setup.items) {
		if (item.type === "category" && item.grade_items) {
			// Add items within category
			for (const gradeItem of item.grade_items) {
				allItems.push({
					id: gradeItem.id,
					name: `${item.name} / ${gradeItem.name}`,
					type: gradeItem.type,
					maxGrade: gradeItem.max_grade,
				});
			}
		} else {
			// Root-level manual item
			allItems.push({
				id: item.id,
				name: item.name,
				type: item.type,
				maxGrade: item.max_grade,
			});
		}
	}

	return (
		<Paper withBorder>
			<ScrollArea>
				<Table striped highlightOnHover stickyHeader>
					<Table.Thead>
						<Table.Tr>
							<Table.Th style={{ minWidth: 200 }}>Student</Table.Th>
							{allItems.map((item) => (
								<Table.Th key={item.id} style={{ minWidth: 150 }}>
									<Stack gap={4}>
										<Text size="sm" fw={500}>
											{item.name}
										</Text>
										<Text size="xs" c="dimmed">
											{item.maxGrade !== null ? `/ ${item.maxGrade}` : ""}
										</Text>
									</Stack>
								</Table.Th>
							))}
							<Table.Th style={{ minWidth: 100 }}>Total</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{enrollments.length === 0 ? (
							<Table.Tr>
								<Table.Td colSpan={allItems.length + 2}>
									<Text c="dimmed" ta="center" py="xl">
										No active students enrolled in this course.
									</Text>
								</Table.Td>
							</Table.Tr>
						) : (
							enrollments.map((enrollment: (typeof enrollments)[number]) => (
								<Table.Tr key={enrollment.id}>
									<Table.Td>
										<Group gap="sm">
											<Avatar size="sm" radius="xl" color="blue">
												{enrollment.name.charAt(0)}
											</Avatar>
											<div>
												<Text size="sm" fw={500}>
													{enrollment.name}
												</Text>
												<Text size="xs" c="dimmed">
													{enrollment.email}
												</Text>
											</div>
										</Group>
									</Table.Td>
									{allItems.map((item) => (
										<Table.Td key={item.id}>
											<Text size="sm" c="dimmed">
												-
											</Text>
										</Table.Td>
									))}
									<Table.Td>
										<Text size="sm" fw={500}>
											-
										</Text>
									</Table.Td>
								</Table.Tr>
							))
						)}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Paper>
	);
}

// ============================================================================
// Recursive Gradebook Item Renderer
// ============================================================================

type GradebookSetupItem = {
	id: number;
	type: string;
	name: string;
	weight: number | null;
	adjusted_weight: number | null;
	overall_weight: number | null;
	weight_explanation: string | null;
	max_grade: number | null;
	extra_credit?: boolean;
	grade_items?: GradebookSetupItem[];
};

function GradebookItemRow({
	item,
	depth = 0,
	getTypeColor,
	expandedCategoryIds,
	onToggleCategory,
}: {
	item: GradebookSetupItem;
	depth?: number;
	getTypeColor: (type: string) => string;
	expandedCategoryIds: number[];
	onToggleCategory: (categoryId: number) => void;
}) {
	const isCategory = item.type === "category";
	const isLeafItem = !isCategory;
	const hasNestedItems = isCategory && item.grade_items && item.grade_items.length > 0;
	const isExpanded = expandedCategoryIds.includes(item.id);

	// Calculate padding based on depth (xl = ~24px per level)
	const paddingLeft = depth * 24;

	// Helper function to recursively sum overall weights of all leaf items in a category
	const sumCategoryOverallWeights = (items: GradebookSetupItem[]): number => {
		let sum = 0;
		for (const childItem of items) {
			if (childItem.type === "category" && childItem.grade_items) {
				sum += sumCategoryOverallWeights(childItem.grade_items);
			} else {
				sum += childItem.overall_weight ?? 0;
			}
		}
		return sum;
	};

	// Calculate category total overall weight (sum of all children)
	const categoryOverallWeight = isCategory && item.grade_items
		? sumCategoryOverallWeights(item.grade_items)
		: null;

	return (
		<>
			<Table.Tr>
				<Table.Td>
					<Group gap="xs" wrap="nowrap" pl={paddingLeft}>
						{hasNestedItems ? (
							<ActionIcon
								variant="subtle"
								size="sm"
								onClick={() => onToggleCategory(item.id)}
								style={{ cursor: "pointer" }}
							>
								<IconChevronRight
									size={16}
									style={{
										transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
										transition: "transform 0.2s",
									}}
								/>
							</ActionIcon>
						) : (
							<Box w={28} />
						)}
						<Text
							size={depth === 0 ? "sm" : "sm"}
							fw={isCategory ? 600 : 500}
						>
							{item.name}
						</Text>
					</Group>
				</Table.Td>
				<Table.Td>
					<Badge color={getTypeColor(item.type)} size="sm">
						{item.type}
					</Badge>
				</Table.Td>
				<Table.Td>
					<WeightDisplay
						weight={item.weight}
						adjustedWeight={item.adjusted_weight}
						extraCredit={item.extra_credit}
					/>
				</Table.Td>
				<Table.Td>
					{/* Overall weight: for leaf items show their weight, for categories show sum of children when collapsed */}
					{isLeafItem ? (
						<OverallWeightDisplay overallWeight={item.overall_weight} weightExplanation={item.weight_explanation} />
					) : (
						// For categories, show sum of children's overall weights when collapsed
						!isExpanded && categoryOverallWeight !== null && categoryOverallWeight > 0 ? (

							<Text size="sm" fw={500} c="dimmed">
								{categoryOverallWeight.toFixed(2)}%
							</Text>
						) : (
							<Text size="sm">-</Text>
						)
					)}
				</Table.Td>
				<Table.Td>
					<Text size="sm">
						{item.max_grade !== null ? item.max_grade : "-"}
					</Text>
				</Table.Td>
				<Table.Td>
					<Button size="xs" variant="subtle" disabled>
						Edit
					</Button>
				</Table.Td>
			</Table.Tr>
			{/* Recursively render nested items */}
			{hasNestedItems && isExpanded && (
				<>
					{item.grade_items?.map((nestedItem) => (
						<GradebookItemRow
							key={nestedItem.id}
							item={nestedItem}
							depth={depth + 1}
							getTypeColor={getTypeColor}
							expandedCategoryIds={expandedCategoryIds}
							onToggleCategory={onToggleCategory}
						/>
					))}
				</>
			)}
		</>
	);
}

function GradebookSetupView({
	loaderData,
	hasExtraCredit,
	displayTotal,
	extraCreditItems,
	totalMaxGrade,
}: {
	loaderData: Route.ComponentProps["loaderData"];
	hasExtraCredit: boolean;
	displayTotal: number;
	extraCreditItems: GradebookSetupItem[];
	totalMaxGrade: number;

}) {
	const { gradebookSetupForUI, flattenedCategories } = loaderData;

	const [itemModalOpened, setItemModalOpened] = useQueryState(
		"createItem",
		parseAsInteger.withOptions({ shallow: false }),
	);
	const [categoryModalOpened, setCategoryModalOpened] = useQueryState(
		"createCategory",
		parseAsInteger.withOptions({ shallow: false }),
	);

	const [expandedCategoryIds, setExpandedCategoryIds] = useState<number[]>([]);

	const toggleCategory = (categoryId: number) => {
		setExpandedCategoryIds((prev) =>
			prev.includes(categoryId)
				? prev.filter((id) => id !== categoryId)
				: [...prev, categoryId]
		);
	};

	if (!gradebookSetupForUI) {
		return (
			<Paper withBorder p="xl">
				<Stack gap="md" align="center">
					<Text c="dimmed" ta="center">
						No gradebook has been set up for this course yet.
					</Text>
					<Button disabled>Create Gradebook</Button>
				</Stack>
			</Paper>
		);
	}

	const { gradebook_setup } = gradebookSetupForUI;

	// Build category options from flattened categories
	const categoryOptions: Array<{ value: string; label: string }> =
		flattenedCategories.map((category) => ({
			value: String(category.id),
			label: category.path,
		}));

	// Build parent category options (same as category options)
	const parentOptions: Array<{ value: string; label: string }> =
		categoryOptions.slice();

	const getTypeColor = (type: string) => {
		switch (type) {
			case "assignment":
				return "blue";
			case "quiz":
				return "grape";
			case "discussion":
				return "teal";
			case "page":
				return "cyan";
			case "whiteboard":
				return "orange";
			case "category":
				return "gray";
			default:
				return "gray";
		}
	};

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={3}>Gradebook Structure</Title>
				<Group gap="sm">
					<Menu position="bottom-end" width={200}>
						<Menu.Target>
							<Button leftSection={<IconPlus size={16} />}>
								Add
							</Button>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item
								leftSection={<IconPlus size={16} />}
								onClick={() => {
									setItemModalOpened(1);
								}}
							>
								Add Grade Item
							</Menu.Item>
							<Menu.Item
								leftSection={<IconFolder size={16} />}
								onClick={() => {
									setCategoryModalOpened(1);
								}}
							>
								Add Category
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
					<Button disabled>Edit Setup</Button>
				</Group>
			</Group>

			<CreateGradeItemModal
				opened={!!itemModalOpened}
				onClose={() => setItemModalOpened(null)}
				categoryOptions={categoryOptions}
			/>

			<CreateCategoryModal
				opened={!!categoryModalOpened}
				onClose={() => setCategoryModalOpened(null)}
				parentOptions={parentOptions}
			/>

			<Paper withBorder>
				<Table>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Name</Table.Th>
							<Table.Th>Type</Table.Th>
							<Table.Th>Weight</Table.Th>
							<Table.Th>Overall Weight</Table.Th>
							<Table.Th>Max Grade</Table.Th>
							<Table.Th>Actions</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{gradebook_setup.items.length === 0 ? (
							<Table.Tr>
								<Table.Td colSpan={6}>
									<Text c="dimmed" ta="center" py="xl">
										No gradebook items configured yet.
									</Text>
								</Table.Td>
							</Table.Tr>
						) : (
							gradebook_setup.items.map((item) => (
								<GradebookItemRow
									key={item.id}
									item={item as GradebookSetupItem}
									depth={0}
									getTypeColor={getTypeColor}
									expandedCategoryIds={expandedCategoryIds}
									onToggleCategory={toggleCategory}
								/>
							))
						)}
					</Table.Tbody>
					<Table.Tfoot>
						<Table.Tr>
							<Table.Td colSpan={2}>
								<Text size="sm" fw={700}>
									Total
								</Text>
							</Table.Td>
							<Table.Td>
								{/* Empty - no weight total */}
							</Table.Td>
							<Table.Td>
								{hasExtraCredit ? (
									<Tooltip
										label={
											<Stack gap="xs">
												<div>
													<Text size="xs" fw={700}>
														Total Overall Weight: {displayTotal.toFixed(2)}%
													</Text>
												</div>
												<div>
													<Text size="xs" fw={700} mb={4}>
														Extra Credit Contributions:
													</Text>
													{extraCreditItems.length > 0 ? (
														extraCreditItems.map((item) => (
															<Text key={item.id} size="xs">
																• {item.name}:{" "}
																{item.overall_weight?.toFixed(2)}%
															</Text>
														))
													) : (
														<Text size="xs">No extra credit items</Text>
													)}
												</div>
												<div>
													<Text size="xs">
														Extra credit items allow the total to exceed 100%.
													</Text>
												</div>
											</Stack>
										}
										withArrow
										multiline
										w={350}
									>
										<Text size="sm" fw={700} style={{ cursor: "help" }}>
											{displayTotal.toFixed(2)}%
										</Text>
									</Tooltip>
								) : (
									<Text size="sm" fw={700}>
										{displayTotal.toFixed(2)}%
									</Text>
								)}
							</Table.Td>
							<Table.Td>
								<Text size="sm" fw={700}>
									{totalMaxGrade}
								</Text>
							</Table.Td>
							<Table.Td>
								{/* Empty - no actions in footer */}
							</Table.Td>
						</Table.Tr>
					</Table.Tfoot>
				</Table>
			</Paper>

			<YAMLDisplay yaml={loaderData.gradebookYaml} />
		</Stack>
	);
}

function YAMLDisplay({ yaml }: { yaml: string | null }) {
	const [opened, { toggle }] = useDisclosure(false);
	return (
		<Paper withBorder p="md">
			<Stack gap="md">
				<Title order={4}>YAML Representation <ActionIcon variant="subtle" onClick={toggle}>
					{opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
				</ActionIcon></Title>
				<Collapse in={opened} onChange={toggle}>
					<ScrollArea h={400}>
						<Code block style={{ fontSize: "0.875rem" }}>
							{yaml || "No gradebook YAML available"}
						</Code>
					</ScrollArea></Collapse>
			</Stack>
		</Paper>
	);
}

export default function CourseGradesPage({ loaderData }: Route.ComponentProps) {
	const { hasExtraCredit, displayTotal, extraCreditItems, totalMaxGrade } = loaderData;
	const [activeTab] = useQueryState("tab", {
		defaultValue: "report",
	});

	return (
		<>
			{activeTab === "setup" ? (
				<GradebookSetupView loaderData={loaderData} hasExtraCredit={hasExtraCredit} displayTotal={displayTotal} extraCreditItems={extraCreditItems} totalMaxGrade={totalMaxGrade} />
			) : (
				<GraderReportView loaderData={loaderData} />
			)}
		</>
	);
}
