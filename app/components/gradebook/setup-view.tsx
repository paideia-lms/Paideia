import { CodeHighlight } from "@mantine/code-highlight";
import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Collapse,
	Group,
	Menu,
	Paper,
	ScrollArea,
	Stack,
	Table,
	Text,
	Title,
	Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	IconChevronDown,
	IconChevronRight,
	IconChevronUp,
	IconFolder,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { href, Link } from "react-router";
import { getModuleIcon } from "../../utils/module-helper";
import { useDeleteCategory, useDeleteManualItem } from "./hooks";
import {
	CreateCategoryModal,
	type CreateCategoryModalHandle,
	CreateGradeItemModal,
	type CreateGradeItemModalHandle,
	UpdateGradeCategoryButton,
	UpdateGradeItemButton,
} from "./modals";
import { getTypeColor } from "./report-view";
import { OverallWeightDisplay, WeightDisplay } from "./weight-display";

// ============================================================================
// Gradebook Setup Types
// ============================================================================

type FlattenedCategory = {
	id: number;
	path: string;
};

type GradebookSetupForUI = {
	gradebook_setup: {
		items: GradebookSetupItem[];
	};
};

export type GradebookSetupData = {
	course: {
		id: number;
	};
	gradebookSetupForUI: GradebookSetupForUI | null;
	flattenedCategories: FlattenedCategory[];
	gradebookYaml: string | null;
	gradebookMarkdown: string | null;
};

// ============================================================================
// Recursive Gradebook Item Renderer
// ============================================================================

export type GradebookSetupItem = {
	id: number;
	type: string;
	name: string;
	weight: number | null;
	adjusted_weight: number | null;
	overall_weight: number | null;
	weight_explanation: string | null;
	max_grade: number | null;
	min_grade: number | null;
	description: string | null;
	category_id: number | null;
	extra_credit?: boolean;
	auto_weighted_zero?: boolean;
	grade_items?: GradebookSetupItem[];
	activityModuleLinkId?: number | null;
};

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

const sumCategoryMaxGrade = (items: GradebookSetupItem[]): number => {
	let sum = 0;
	for (const childItem of items) {
		if (childItem.type === "category" && childItem.grade_items) {
			sum += sumCategoryMaxGrade(childItem.grade_items);
		} else {
			sum += childItem.max_grade ?? 0;
		}
	}
	return sum;
};

function GradebookItemRow({
	item,
	depth = 0,
	expandedCategoryIds,
	onToggleCategory,
	onDeleteItem,
	onDeleteCategory,
	categoryOptions,
	courseId,
}: {
	item: GradebookSetupItem;
	depth?: number;
	expandedCategoryIds: number[];
	onToggleCategory: (categoryId: number) => void;
	onDeleteItem?: (itemId: number) => void;
	onDeleteCategory?: (categoryId: number) => void;
	categoryOptions: Array<{ value: string; label: string }>;
	courseId: number;
}) {
	const isCategory = item.type === "category";
	const isLeafItem = !isCategory;
	const hasNestedItems =
		isCategory && item.grade_items && item.grade_items.length > 0;
	const isExpanded = expandedCategoryIds.includes(item.id);

	// Calculate padding based on depth (xl = ~24px per level)
	const paddingLeft = depth * 24;

	// Calculate category total overall weight (sum of all children)
	const categoryOverallWeight =
		isCategory && item.grade_items
			? sumCategoryOverallWeights(item.grade_items)
			: null;

	const categoryMaxGrade =
		isCategory && item.grade_items
			? sumCategoryMaxGrade(item.grade_items)
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
						{isLeafItem && item.activityModuleLinkId ? (
							<Link
								to={href("/course/module/:moduleLinkId", {
									moduleLinkId: item.activityModuleLinkId.toString(),
								})}
								style={{ textDecoration: "none", color: "inherit" }}
							>
								<Text
									size={depth === 0 ? "sm" : "sm"}
									fw={isCategory ? 600 : 500}
									style={{ cursor: "pointer" }}
								>
									{item.name}
								</Text>
							</Link>
						) : (
							<Text
								size={depth === 0 ? "sm" : "sm"}
								fw={isCategory ? 600 : 500}
							>
								{item.name}
							</Text>
						)}
					</Group>
				</Table.Td>
				<Table.Td>
					<Group gap="xs" wrap="nowrap">
						{(item.type === "quiz" ||
							item.type === "assignment" ||
							item.type === "discussion") &&
							getModuleIcon(
								item.type as "quiz" | "assignment" | "discussion",
								16,
							)}
						<Badge color={getTypeColor(item.type)} size="sm">
							{item.type}
						</Badge>
					</Group>
				</Table.Td>
				<Table.Td>
					<WeightDisplay
						weight={item.weight}
						adjustedWeight={item.adjusted_weight}
						extraCredit={item.extra_credit}
						isCategory={isCategory}
						autoWeightedZero={item.auto_weighted_zero ?? false}
					/>
				</Table.Td>
				<Table.Td>
					{/* Effective weight: for leaf items show their weight, for categories show sum of children when collapsed */}
					{isLeafItem ? (
						<OverallWeightDisplay
							overallWeight={item.overall_weight}
							weightExplanation={item.weight_explanation}
							extraCredit={item.extra_credit}
						/>
					) : // For categories, show sum of children's overall weights when collapsed
					!isExpanded &&
						categoryOverallWeight !== null &&
						categoryOverallWeight > 0 ? (
						<Text size="sm" fw={500} c="dimmed">
							{categoryOverallWeight.toFixed(2)}%
						</Text>
					) : (
						<Text size="sm">-</Text>
					)}
				</Table.Td>
				<Table.Td>
					{isLeafItem ? (
						<Text size="sm">
							{item.max_grade !== null ? item.max_grade : "-"}
						</Text>
					) : // calculate the max grade of all leaf items
					!isExpanded && item.grade_items && item.grade_items.length > 0 ? (
						<Text size="sm" c="dimmed">
							{categoryMaxGrade ?? "-"}
						</Text>
					) : (
						<Text size="sm">-</Text>
					)}
				</Table.Td>
				<Table.Td>
					<Group gap="xs" wrap="nowrap">
						{isCategory ? (
							<UpdateGradeCategoryButton
								category={{
									id: item.id,
									name: item.name,
									description: null,
									weight: item.weight,
									extraCredit: item.extra_credit ?? false,
									hasItems: hasNestedItems ?? false,
								}}
							/>
						) : (
							<UpdateGradeItemButton
								item={{
									id: item.id,
									name: item.name,
									description: item.description,
									categoryId: item.category_id,
									maxGrade: item.max_grade,
									minGrade: item.min_grade,
									weight: item.weight,
									adjustedWeight: item.adjusted_weight,
									extraCredit: item.extra_credit ?? false,
								}}
								categoryOptions={categoryOptions}
								courseId={courseId}
							/>
						)}
						{/* Show delete button for categories */}
						{isCategory && onDeleteCategory && (
							<ActionIcon
								size="sm"
								variant="subtle"
								color="red"
								onClick={() => onDeleteCategory(item.id)}
							>
								<IconTrash size={16} />
							</ActionIcon>
						)}
						{/* Show delete button only for manual items (items without activityModuleLinkId) */}
						{isLeafItem && !item.activityModuleLinkId && onDeleteItem && (
							<ActionIcon
								size="sm"
								variant="subtle"
								color="red"
								onClick={() => onDeleteItem(item.id)}
							>
								<IconTrash size={16} />
							</ActionIcon>
						)}
					</Group>
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
							expandedCategoryIds={expandedCategoryIds}
							onToggleCategory={onToggleCategory}
							onDeleteItem={onDeleteItem}
							onDeleteCategory={onDeleteCategory}
							categoryOptions={categoryOptions}
							courseId={courseId}
						/>
					))}
				</>
			)}
		</>
	);
}

function YAMLDisplay({ yaml }: { yaml: string | null }) {
	const [opened, { toggle }] = useDisclosure(false);
	return (
		<Paper withBorder p="md">
			<Stack gap="md">
				<Title order={4}>
					YAML Representation{" "}
					<ActionIcon variant="subtle" onClick={toggle}>
						{opened ? (
							<IconChevronUp size={16} />
						) : (
							<IconChevronDown size={16} />
						)}
					</ActionIcon>
				</Title>
				<Collapse in={opened} onChange={toggle}>
					<ScrollArea h={400}>
						<CodeHighlight
							code={yaml || "No gradebook YAML available"}
							language="yaml"
							copyLabel="Copy YAML"
							copiedLabel="Copied!"
							radius="md"
						/>
					</ScrollArea>
				</Collapse>
			</Stack>
		</Paper>
	);
}

function MDDisplay({ markdown }: { markdown: string | null }) {
	const [opened, { toggle }] = useDisclosure(false);
	return (
		<Paper withBorder p="md">
			<Stack gap="md">
				<Title order={4}>
					Markdown Representation{" "}
					<ActionIcon variant="subtle" onClick={toggle}>
						{opened ? (
							<IconChevronUp size={16} />
						) : (
							<IconChevronDown size={16} />
						)}
					</ActionIcon>
				</Title>
				<Collapse in={opened} onChange={toggle}>
					<ScrollArea h={400}>
						<CodeHighlight
							code={markdown || "No gradebook markdown available"}
							language="markdown"
							copyLabel="Copy Markdown"
							copiedLabel="Copied!"
							radius="md"
						/>
					</ScrollArea>
				</Collapse>
			</Stack>
		</Paper>
	);
}

export function GradebookSetupView({
	data,
	hasExtraCredit,
	displayTotal,
	extraCreditItems,
	extraCreditCategories,
	totalMaxGrade,
}: {
	data: GradebookSetupData;
	hasExtraCredit: boolean;
	displayTotal: number;
	extraCreditItems: GradebookSetupItem[];
	extraCreditCategories: GradebookSetupItem[];
	totalMaxGrade: number;
}) {
	const { gradebookSetupForUI, flattenedCategories } = data;

	const createItemModalRef = useRef<CreateGradeItemModalHandle>(null);
	const createCategoryModalRef = useRef<CreateCategoryModalHandle>(null);

	const [expandedCategoryIds, setExpandedCategoryIds] = useState<number[]>([]);
	const { deleteManualItem } = useDeleteManualItem();
	const { deleteCategory } = useDeleteCategory();

	const toggleCategory = (categoryId: number) => {
		setExpandedCategoryIds((prev) =>
			prev.includes(categoryId)
				? prev.filter((id) => id !== categoryId)
				: [...prev, categoryId],
		);
	};

	const handleDeleteItem = (itemId: number) => {
		if (confirm("Are you sure you want to delete this gradebook item?")) {
			deleteManualItem(data.course.id, itemId);
		}
	};

	const handleDeleteCategory = (categoryId: number) => {
		if (
			confirm(
				"Are you sure you want to delete this category? The category must be empty (no items or subcategories) to be deleted.",
			)
		) {
			deleteCategory(data.course.id, categoryId);
		}
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

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={3}>Gradebook Structure</Title>
				<Group gap="sm">
					<Menu position="bottom-end" width={200}>
						<Menu.Target>
							<Button leftSection={<IconPlus size={16} />}>Add</Button>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item
								leftSection={<IconPlus size={16} />}
								onClick={() => {
									createItemModalRef.current?.open();
								}}
							>
								Add Grade Item
							</Menu.Item>
							<Menu.Item
								leftSection={<IconFolder size={16} />}
								onClick={() => {
									createCategoryModalRef.current?.open();
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
				ref={createItemModalRef}
				categoryOptions={categoryOptions}
				courseId={data.course.id}
			/>

			<CreateCategoryModal
				ref={createCategoryModalRef}
				parentOptions={parentOptions}
			/>

			<Paper withBorder>
				<Table>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Name</Table.Th>
							<Table.Th>Type</Table.Th>
							<Table.Th>Weight</Table.Th>
							<Table.Th>Effective Weight</Table.Th>
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
									item={item}
									depth={0}
									expandedCategoryIds={expandedCategoryIds}
									onToggleCategory={toggleCategory}
									onDeleteItem={handleDeleteItem}
									onDeleteCategory={handleDeleteCategory}
									categoryOptions={categoryOptions}
									courseId={data.course.id}
								/>
							))
						)}
					</Table.Tbody>
					{gradebook_setup.items.length > 0 && (
						<Table.Tfoot>
							<Table.Tr>
								<Table.Td colSpan={2}>
									<Text size="sm" fw={700}>
										Total
									</Text>
								</Table.Td>
								<Table.Td>{/* Empty - no weight total */}</Table.Td>
								<Table.Td>
									{hasExtraCredit ? (
										<Tooltip
											label={
												<Stack gap="xs">
													<div>
														<Text size="xs" fw={700}>
															Total Effective Weight: {displayTotal.toFixed(2)}%
														</Text>
													</div>
													<div>
														<Text size="xs" fw={700} mb={4}>
															Extra Credit Contributions:
														</Text>
														{extraCreditCategories.length > 0 ||
														extraCreditItems.length > 0 ? (
															<>
																{extraCreditCategories.map((category) => (
																	<Text key={category.id} size="xs">
																		• {category.name} (Category):{" "}
																		{category.overall_weight?.toFixed(2)}%
																	</Text>
																))}
																{extraCreditItems.map((item) => (
																	<Text key={item.id} size="xs">
																		• {item.name}:{" "}
																		{item.overall_weight?.toFixed(2)}%
																	</Text>
																))}
															</>
														) : (
															<Text size="xs">No extra credit items</Text>
														)}
													</div>
													<div>
														<Text size="xs">
															Extra credit items and categories allow the total
															to exceed 100%.
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
								<Table.Td>{/* Empty - no actions in footer */}</Table.Td>
							</Table.Tr>
						</Table.Tfoot>
					)}
				</Table>
			</Paper>

			<YAMLDisplay yaml={data.gradebookYaml} />
			<MDDisplay markdown={data.gradebookMarkdown} />
		</Stack>
	);
}
