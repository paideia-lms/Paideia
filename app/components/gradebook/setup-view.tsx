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
} from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { parseAsInteger } from "nuqs/server";
import { useState } from "react";
import { href, Link } from "react-router";
import { getModuleIcon } from "../../utils/module-helper";
import { CreateCategoryModal, CreateGradeItemModal } from "./modals";
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
	extra_credit?: boolean;
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
	getTypeColor,
	expandedCategoryIds,
	onToggleCategory,
	onEditItem,
	onEditCategory,
}: {
	item: GradebookSetupItem;
	depth?: number;
	getTypeColor: (type: string) => string;
	expandedCategoryIds: number[];
	onToggleCategory: (categoryId: number) => void;
	onEditItem?: (itemId: number) => void;
	onEditCategory?: (categoryId: number) => void;
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
					/>
				</Table.Td>
				<Table.Td>
					{/* Overall weight: for leaf items show their weight, for categories show sum of children when collapsed */}
					{isLeafItem ? (
						<OverallWeightDisplay
							overallWeight={item.overall_weight}
							weightExplanation={item.weight_explanation}
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
					<Button
						size="xs"
						variant="subtle"
						onClick={() => {
							if (isCategory && onEditCategory) {
								onEditCategory(item.id);
							} else if (!isCategory && onEditItem) {
								onEditItem(item.id);
							}
						}}
					>
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
							onEditItem={onEditItem}
							onEditCategory={onEditCategory}
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
	totalMaxGrade,
}: {
	data: GradebookSetupData;
	hasExtraCredit: boolean;
	displayTotal: number;
	extraCreditItems: GradebookSetupItem[];
	totalMaxGrade: number;
}) {
	const { gradebookSetupForUI, flattenedCategories } = data;

	const [itemModalOpened, setItemModalOpened] = useQueryState(
		"createItem",
		parseAsInteger.withOptions({ shallow: false }),
	);
	const [categoryModalOpened, setCategoryModalOpened] = useQueryState(
		"createCategory",
		parseAsInteger.withOptions({ shallow: false }),
	);

	const [editingItemId, setEditingItemId] = useState<number | null>(null);
	const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
		null,
	);

	const [expandedCategoryIds, setExpandedCategoryIds] = useState<number[]>([]);

	const toggleCategory = (categoryId: number) => {
		setExpandedCategoryIds((prev) =>
			prev.includes(categoryId)
				? prev.filter((id) => id !== categoryId)
				: [...prev, categoryId],
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
							<Button leftSection={<IconPlus size={16} />}>Add</Button>
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
				opened={!!itemModalOpened || editingItemId !== null}
				onClose={() => {
					setItemModalOpened(null);
					setEditingItemId(null);
				}}
				categoryOptions={categoryOptions}
				itemId={editingItemId}
				courseId={data.course.id}
			/>

			<CreateCategoryModal
				opened={!!categoryModalOpened || editingCategoryId !== null}
				onClose={() => {
					setCategoryModalOpened(null);
					setEditingCategoryId(null);
				}}
				parentOptions={parentOptions}
				categoryId={editingCategoryId}
				courseId={data.course.id}
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
									onEditItem={(itemId) => setEditingItemId(itemId)}
									onEditCategory={(categoryId) =>
										setEditingCategoryId(categoryId)
									}
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
