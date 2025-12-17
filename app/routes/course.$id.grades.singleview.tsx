import { CodeHighlight } from "@mantine/code-highlight";
import {
	ActionIcon,
	Anchor,
	Badge,
	Box,
	Group,
	Paper,
	ScrollArea,
	Select,
	Stack,
	Table,
	Tabs,
	Text,
	Title,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import type { GradebookSetupItem } from "app/components/gradebook/setup-view";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useQueryState } from "nuqs";
import { createLoader, parseAsInteger } from "nuqs/server";
import { useState } from "react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import type { SingleUserGradesJsonRepresentation } from "server/internal/user-grade-management";
import { tryGetAdjustedSingleUserGrades } from "server/internal/user-grade-management";
import { getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.grades.singleview";

dayjs.extend(utc);
dayjs.extend(timezone);

// Define search params for user selection
export const singleViewSearchParams = {
	userId: parseAsInteger,
};

export const loadSearchParams = createLoader(singleViewSearchParams);

const defaultSingleUserGradesResult = {
	json: null,
	yaml: null,
	markdown: null,
};

export const loader = async ({
	context,
	params,
	request,
}: Route.LoaderArgs) => {
	const { payload, hints, payloadRequest } = context.get(globalContextKey);
	const courseContext = context.get(courseContextKey);
	const userSession = context.get(userContextKey);
	const timeZone = hints.timeZone;

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	// Prepare user object for internal functions
	// Get selected user from search params
	const { userId } = loadSearchParams(request);

	// Filter to only student enrollments
	const studentEnrollments = courseContext.course.enrollments.filter(
		(e) => e.role === "student",
	);

	// Find enrollment for the selected user (only from students)
	const enrollment = studentEnrollments.find((e) => e.user.id === userId);

	const singleUserGradesResult =
		userId && enrollment
			? await tryGetAdjustedSingleUserGrades({
					payload,
					req: payloadRequest,
					courseId: courseContext.course.id,
					enrollmentId: enrollment.id,
				}).getOrDefault(defaultSingleUserGradesResult)
			: defaultSingleUserGradesResult;

	return {
		course: courseContext.course,
		enrollments: studentEnrollments,
		singleUserGrades: singleUserGradesResult.json,
		singleUserGradesYaml: singleUserGradesResult.yaml,
		singleUserGradesMarkdown: singleUserGradesResult.markdown,
		selectedUserId: userId,
		timeZone,
		gradebookSetupForUI: courseContext.gradebookSetupForUI,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseGradesSingleViewPage({
	loaderData,
}: Route.ComponentProps) {
	const {
		enrollments,
		singleUserGrades,
		selectedUserId: _selectedUserId,
	} = loaderData;

	const [selectedUserId, setSelectedUserId] = useQueryState(
		"userId",
		parseAsInteger.withOptions({
			shallow: false,
		}),
	);

	// Prepare user select options
	const userOptions = enrollments.map((enrollment) => ({
		value: enrollment.user.id.toString(),
		label: enrollment.user.firstName + " " + enrollment.user.lastName,
	}));

	const title = `Single User Grade View | ${loaderData.course.title} | Paideia LMS`;
	return (
		<Stack gap="lg">
			<title>{title}</title>
			<meta
				name="description"
				content="View detailed grade breakdown for a single user"
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content="View detailed grade breakdown for a single user"
			/>
			<Paper withBorder shadow="sm" p="lg" radius="md">
				<Stack gap="md">
					<Title order={3}>Single User Grade View</Title>
					<Select
						label="Select User"
						placeholder="Choose a user to view their grade JSON representation"
						data={userOptions}
						value={selectedUserId?.toString() || null}
						onChange={(value) => {
							setSelectedUserId(value ? Number(value) : null);
						}}
						searchable
						clearable
					/>
				</Stack>
			</Paper>

			{!selectedUserId && (
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Text c="dimmed" ta="center">
						Select a user from the dropdown above to view their grade JSON
						representation.
					</Text>
				</Paper>
			)}

			{singleUserGrades && (
				<SingleUserGradeTableView
					data={singleUserGrades}
					yaml={loaderData.singleUserGradesYaml}
					markdown={loaderData.singleUserGradesMarkdown}
					timeZone={loaderData.timeZone}
					gradebookSetupForUI={loaderData.gradebookSetupForUI}
				/>
			)}
		</Stack>
	);
}

const getStatusBadgeColor = (status: string) => {
	switch (status) {
		case "graded":
			return "green";
		case "submitted":
			return "blue";
		case "draft":
			return "gray";
		default:
			return "gray";
	}
};

const getStatusLabel = (status: string) => {
	switch (status) {
		case "graded":
			return "Graded";
		case "submitted":
			return "Submitted";
		case "draft":
			return "Draft";
		default:
			return status;
	}
};

const formatDate = (
	dateString: string | null | undefined,
	timeZone?: string,
) => {
	if (!dateString) return "-";
	try {
		if (timeZone) {
			return dayjs(dateString).tz(timeZone).format("MMM DD, YYYY h:mm A");
		}
		return dayjs(dateString).format("MMM DD, YYYY h:mm A");
	} catch {
		return dateString;
	}
};

type GradeItemWithData = GradebookSetupItem & {
	gradeData?: {
		base_grade: number | null;
		override_grade: number | null;
		is_overridden: boolean;
		feedback: string | null;
		graded_at: string | null;
		submitted_at: string | null;
		status: "draft" | "graded" | "returned";
		adjustments: Array<{
			points: number;
			reason: string;
			is_active: boolean;
		}>;
	};
};

function GradeItemRow({
	item,
	depth = 0,
	expandedCategoryIds,
	onToggleCategory,
	timeZone,
}: {
	item: GradeItemWithData;
	depth?: number;
	expandedCategoryIds: number[];
	onToggleCategory: (categoryId: number) => void;
	timeZone?: string;
}) {
	const isCategory = item.type === "category";
	const hasNestedItems =
		isCategory && item.grade_items && item.grade_items.length > 0;
	const isExpanded = expandedCategoryIds.includes(item.id);

	// Calculate padding based on depth (xl = ~24px per level)
	const paddingLeft = depth * 24;

	const gradeData = item.gradeData;

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
						{isCategory ? (
							<Text size="sm" fw={600}>
								{item.name}
							</Text>
						) : item.activityModuleLinkId ? (
							<Link
								to={href("/course/module/:moduleLinkId", {
									moduleLinkId: item.activityModuleLinkId.toString(),
								})}
								style={{ textDecoration: "none", color: "inherit" }}
							>
								<Text size="sm" fw={500} style={{ cursor: "pointer" }}>
									{item.name}
								</Text>
							</Link>
						) : (
							<Text size="sm" fw={500}>
								{item.name}
							</Text>
						)}
					</Group>
				</Table.Td>
				<Table.Td>
					{isCategory ? (
						<Text size="sm" c="dimmed">
							Category
						</Text>
					) : (
						<Group gap="xs" wrap="nowrap">
							{item.type !== "manual_item" &&
								getModuleIcon(
									item.type as "quiz" | "assignment" | "discussion",
								)}
							<Text size="sm" tt="capitalize">
								{item.type === "manual_item" ? "Manual Item" : item.type}
							</Text>
						</Group>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : item.weight !== null && item.weight !== undefined ? (
						<Text size="sm">{item.weight.toFixed(2)}%</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : (
						<Text size="sm">
							{item.max_grade !== null ? item.max_grade : "-"}
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory || !gradeData ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : gradeData.base_grade !== null ? (
						<Text size="sm" fw={500}>
							{gradeData.base_grade}
						</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory || !gradeData ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : gradeData.is_overridden && gradeData.override_grade !== null ? (
						<Text size="sm" fw={500} c="orange">
							{gradeData.override_grade}
						</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory || !gradeData ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : (
						<Badge
							color={getStatusBadgeColor(gradeData.status)}
							variant="light"
							size="sm"
						>
							{getStatusLabel(gradeData.status)}
						</Badge>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory || !gradeData ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : gradeData.feedback ? (
						<Text size="sm" lineClamp={2}>
							{gradeData.feedback}
						</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory || !gradeData ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : (
						<Text size="sm">{formatDate(gradeData.graded_at, timeZone)}</Text>
					)}
				</Table.Td>
				<Table.Td>
					{isCategory || !gradeData ? (
						<Text size="sm" c="dimmed">
							-
						</Text>
					) : (
						<Text size="sm">
							{formatDate(gradeData.submitted_at, timeZone)}
						</Text>
					)}
				</Table.Td>
			</Table.Tr>
			{/* Recursively render nested items */}
			{hasNestedItems &&
				isExpanded &&
				item.grade_items?.map((nestedItem) => (
					<GradeItemRow
						key={nestedItem.id}
						item={nestedItem}
						depth={depth + 1}
						expandedCategoryIds={expandedCategoryIds}
						onToggleCategory={onToggleCategory}
						timeZone={timeZone}
					/>
				))}
		</>
	);
}

/**
 * Recursively matches grade items from the flat array to the nested gradebook structure
 */
function matchItemsToStructure(
	structureItems: GradebookSetupItem[],
	gradeItems: Map<
		number,
		SingleUserGradesJsonRepresentation["enrollment"]["items"][0]
	>,
): GradeItemWithData[] {
	const result: GradeItemWithData[] = [];

	for (const item of structureItems) {
		if (item.type === "category") {
			// For categories, recursively process nested items
			const nestedItems = item.grade_items
				? matchItemsToStructure(item.grade_items, gradeItems)
				: [];

			result.push({
				...item,
				grade_items: nestedItems.length > 0 ? nestedItems : undefined,
			});
		} else {
			// For grade items, find matching grade data
			const gradeData = gradeItems.get(item.id);
			result.push({
				...item,
				// Use weight from grade data if available, otherwise use from structure
				weight: gradeData?.weight ?? item.weight,
				gradeData: gradeData
					? {
							base_grade: gradeData.base_grade ?? null,
							override_grade: gradeData.override_grade ?? null,
							is_overridden: gradeData.is_overridden,
							feedback: gradeData.feedback ?? null,
							graded_at: gradeData.graded_at ?? null,
							submitted_at: gradeData.submitted_at ?? null,
							status: gradeData.status,
							adjustments: gradeData.adjustments ?? [],
						}
					: undefined,
			});
		}
	}

	return result;
}

function SingleUserGradeTableView({
	data,
	yaml,
	markdown,
	timeZone,
	gradebookSetupForUI,
}: {
	data: SingleUserGradesJsonRepresentation;
	yaml: string | null;
	markdown: string | null;
	timeZone?: string;
	gradebookSetupForUI: {
		gradebook_setup: { items: GradebookSetupItem[] };
	};
}) {
	const { enrollment, course_id } = data;
	const [expandedCategoryIds, setExpandedCategoryIds] = useState<number[]>([]);

	const toggleCategory = (categoryId: number) => {
		setExpandedCategoryIds((prev) =>
			prev.includes(categoryId)
				? prev.filter((id) => id !== categoryId)
				: [...prev, categoryId],
		);
	};

	// Create a map of item_id -> grade data for quick lookup
	const gradeItemsMap = new Map(
		enrollment.items.map((item) => [item.item_id, item]),
	);

	// Match items to nested structure if gradebook setup is available
	const nestedItems: GradeItemWithData[] = matchItemsToStructure(
		gradebookSetupForUI.gradebook_setup.items,
		gradeItemsMap,
	);

	// Helper function to recursively collect all leaf items (non-category items)
	const collectLeafItems = (
		items: GradeItemWithData[],
	): GradeItemWithData[] => {
		const result: GradeItemWithData[] = [];
		for (const item of items) {
			if (item.type === "category" && item.grade_items) {
				result.push(...collectLeafItems(item.grade_items));
			} else if (item.type !== "category") {
				result.push(item);
			}
		}
		return result;
	};

	// Calculate totals from all leaf items
	const allLeafItems = collectLeafItems(nestedItems);
	const totalGrade = allLeafItems.reduce((sum, item) => {
		const grade = item.gradeData?.base_grade ?? null;
		return sum + (grade !== null && grade !== undefined ? grade : 0);
	}, 0);
	const totalMaxGrade = allLeafItems.reduce((sum, item) => {
		return sum + (item.max_grade ?? 0);
	}, 0);
	const hasAnyGrade = allLeafItems.some(
		(item) =>
			item.gradeData?.base_grade !== null &&
			item.gradeData?.base_grade !== undefined,
	);

	return (
		<Stack gap="lg">
			{/* User Summary Card */}
			<Paper withBorder shadow="sm" p="lg" radius="md">
				<Stack gap="md">
					<Title order={4}>Student Information</Title>
					<Group gap="xl">
						<div>
							<Text size="sm" c="dimmed">
								Name
							</Text>
							<Anchor
								size="md"
								fw={500}
								component={Link}
								to={
									href("/course/:courseId/participants/profile", {
										courseId: course_id.toString(),
									}) + `?userId=${enrollment.user_id}`
								}
							>
								{enrollment.user_name}
							</Anchor>
						</div>
						<div>
							<Text size="sm" c="dimmed">
								Email
							</Text>
							<Text size="md" fw={500}>
								{enrollment.user_email}
							</Text>
						</div>
						<div>
							<Text size="sm" c="dimmed">
								Final Grade
							</Text>
							<Text size="lg" fw={700}>
								{enrollment.final_grade !== null &&
								enrollment.final_grade !== undefined
									? enrollment.final_grade.toFixed(2)
									: "-"}
							</Text>
						</div>
						<div>
							<Text size="sm" c="dimmed">
								Total Weight
							</Text>
							<Text size="md" fw={500}>
								{enrollment.total_weight.toFixed(2)}%
							</Text>
						</div>
						<div>
							<Text size="sm" c="dimmed">
								Graded Items
							</Text>
							<Text size="md" fw={500}>
								{enrollment.graded_items} / {enrollment.items.length}
							</Text>
						</div>
					</Group>
				</Stack>
			</Paper>

			{/* Grades Table */}
			<Paper withBorder shadow="sm" p="lg" radius="md">
				<Stack gap="md">
					<Title order={4}>Grade Items</Title>
					<Tabs defaultValue="table">
						<Tabs.List>
							<Tabs.Tab value="table">Table</Tabs.Tab>
							<Tabs.Tab value="yaml">YAML</Tabs.Tab>
							<Tabs.Tab value="markdown">Markdown</Tabs.Tab>
						</Tabs.List>

						<Tabs.Panel value="table" pt="md">
							<ScrollArea>
								<Table
									striped
									highlightOnHover
									withColumnBorders
									withTableBorder
								>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Item Name</Table.Th>
											<Table.Th>Type</Table.Th>
											<Table.Th>Weight</Table.Th>
											<Table.Th>Max Grade</Table.Th>
											<Table.Th>Base Grade</Table.Th>
											<Table.Th>Override Grade</Table.Th>
											<Table.Th>Status</Table.Th>
											<Table.Th>Feedback</Table.Th>
											<Table.Th>Graded At</Table.Th>
											<Table.Th>Submitted At</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{nestedItems.length === 0 ? (
											<Table.Tr>
												<Table.Td colSpan={10}>
													<Text c="dimmed" ta="center" py="xl">
														No grade items found.
													</Text>
												</Table.Td>
											</Table.Tr>
										) : (
											nestedItems.map((item) => (
												<GradeItemRow
													key={item.id}
													item={item}
													depth={0}
													expandedCategoryIds={expandedCategoryIds}
													onToggleCategory={toggleCategory}
													timeZone={timeZone}
												/>
											))
										)}
									</Table.Tbody>
									<Table.Tfoot>
										<Table.Tr
											style={{ backgroundColor: "var(--mantine-color-gray-0)" }}
										>
											<Table.Td>
												<Text size="sm" fw={700}>
													Total
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													-
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													-
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" fw={500}>
													{totalMaxGrade}
												</Text>
											</Table.Td>
											<Table.Td>
												{hasAnyGrade ? (
													<Text size="sm" fw={700}>
														{totalGrade.toFixed(2)}
													</Text>
												) : (
													<Text size="sm" c="dimmed">
														-
													</Text>
												)}
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													-
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													-
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													-
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													-
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													-
												</Text>
											</Table.Td>
										</Table.Tr>
									</Table.Tfoot>
								</Table>
							</ScrollArea>
						</Tabs.Panel>

						<Tabs.Panel value="yaml" pt="md">
							<ScrollArea h={400}>
								<CodeHighlight
									code={yaml || "No YAML representation available"}
									language="yaml"
									copyLabel="Copy YAML"
									copiedLabel="Copied!"
									radius="md"
								/>
							</ScrollArea>
						</Tabs.Panel>

						<Tabs.Panel value="markdown" pt="md">
							<ScrollArea h={400}>
								<CodeHighlight
									code={markdown || "No Markdown representation available"}
									language="markdown"
									copyLabel="Copy Markdown"
									copiedLabel="Copied!"
									radius="md"
								/>
							</ScrollArea>
						</Tabs.Panel>
					</Tabs>

					{/* Adjustments Section */}
					{(() => {
						// Helper function to recursively collect items with adjustments
						const collectItemsWithAdjustments = (
							items: GradeItemWithData[],
						): GradeItemWithData[] => {
							const result: GradeItemWithData[] = [];
							for (const item of items) {
								if (
									item.gradeData?.adjustments &&
									item.gradeData.adjustments.length > 0
								) {
									result.push(item);
								}
								if (item.grade_items) {
									result.push(...collectItemsWithAdjustments(item.grade_items));
								}
							}
							return result;
						};

						const itemsWithAdjustments =
							collectItemsWithAdjustments(nestedItems);

						return itemsWithAdjustments.length > 0 ? (
							<Stack gap="md" mt="md">
								<Title order={5}>Grade Adjustments</Title>
								{itemsWithAdjustments.map((item) => {
									if (
										!item.gradeData?.adjustments ||
										item.gradeData.adjustments.length === 0
									) {
										return null;
									}

									return (
										<Paper key={item.id} withBorder p="md" radius="md">
											<Stack gap="xs">
												<Text size="sm" fw={600}>
													{item.name}
												</Text>
												{item.gradeData.adjustments.map((adjustment, idx) => (
													<Group
														key={`${item.id}-adjustment-${idx}-${adjustment.reason}`}
														justify="space-between"
														gap="md"
													>
														<div>
															<Text size="sm">{adjustment.reason}</Text>
															<Text size="xs" c="dimmed">
																{adjustment.is_active ? "Active" : "Inactive"}
															</Text>
														</div>
														<Badge
															color={adjustment.points >= 0 ? "green" : "red"}
															variant="light"
														>
															{adjustment.points >= 0 ? "+" : ""}
															{adjustment.points} points
														</Badge>
													</Group>
												))}
											</Stack>
										</Paper>
									);
								})}
							</Stack>
						) : null;
					})()}
				</Stack>
			</Paper>
		</Stack>
	);
}
