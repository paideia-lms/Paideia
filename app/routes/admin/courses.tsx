import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Checkbox,
	Container,
	Group,
	Menu,
	Modal,
	Pagination,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	IconDatabase,
	IconDots,
	IconEye,
	IconFolder,
	IconPlus,
	IconReportAnalytics,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { useState } from "react";
import { href, Link } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type CategoryTreeNode,
	tryGetCategoryTree,
} from "server/internal/course-category-management";
import { tryFindAllCourses } from "server/internal/course-management";
import type { Course } from "server/payload-types";
import CourseSearchInput from "~/components/course-search-input";
import { ForbiddenResponse } from "~/utils/responses";
import { useBatchUpdateCourses } from "../api/batch-update-courses";
import type { Route } from "./+types/courses";

// Define search params
export const coursesSearchParams = {
	query: parseAsString.withDefault(""),
	page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(coursesSearchParams);

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view all courses");
	}

	// Get search params from URL
	const { query, page } = loadSearchParams(request);

	// Fetch courses with search and pagination
	const coursesResult = await tryFindAllCourses({
		payload,
		query: query || undefined,
		limit: 10,
		page,
		sort: "-createdAt",
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
	});

	if (!coursesResult.ok) {
		throw new ForbiddenResponse("Failed to get courses");
	}

	// categories for batch update select
	const categoriesResult = await tryGetCategoryTree(payload);
	const flatCategories: { value: string; label: string }[] = [];
	if (categoriesResult.ok) {
		const visit = (nodes: CategoryTreeNode[], prefix: string) => {
			for (const n of nodes) {
				flatCategories.push({
					value: String(n.id),
					label: `${prefix}${n.name}`,
				});
				if (n.subcategories?.length) visit(n.subcategories, `${prefix}— `);
			}
		};
		visit(categoriesResult.value, "");
	}

	const courses = coursesResult.value.docs.map((course) => {
		const createdBy = course.createdBy;
		const createdByName =
			createdBy !== null
				? `${createdBy.firstName || ""} ${createdBy.lastName || ""}`.trim() ||
					createdBy.email
				: "Unknown";

		const category = course.category;
		const categoryName = category !== null ? category.name || "-" : "-";

		return {
			id: course.id,
			title: course.title,
			slug: course.slug,
			description: course.description,
			status: course.status,
			categoryName,
			createdBy: createdByName,
			createdAt: course.createdAt,
		};
	});

	return {
		courses,
		totalCourses: coursesResult.value.totalDocs,
		totalPages: coursesResult.value.totalPages,
		currentPage: coursesResult.value.page,
		categories: flatCategories,
	};
};

export default function CoursesPage({ loaderData }: Route.ComponentProps) {
	const { courses, totalCourses, totalPages, currentPage, categories } =
		loaderData;
	const [page, setPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(1).withOptions({ shallow: false }),
	);

	// Handle page change
	const handlePageChange = (newPage: number) => {
		setPage(newPage);
	};

	const getStatusBadgeColor = (status: Course["status"]) => {
		switch (status) {
			case "published":
				return "green";
			case "draft":
				return "yellow";
			case "archived":
				return "gray";
			default:
				return "gray";
		}
	};

	const getStatusLabel = (status: Course["status"]) => {
		switch (status) {
			case "published":
				return "Published";
			case "draft":
				return "Draft";
			case "archived":
				return "Archived";
			default:
				return status;
		}
	};

	const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [categoryModalOpened, setCategoryModalOpened] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
	const [statusModalOpened, setStatusModalOpened] = useState(false);
	const { batchUpdateCourses, isLoading } = useBatchUpdateCourses();

	const allOnPageIds = courses.map((c) => c.id as number);
	const allSelectedOnPage = allOnPageIds.every((id: number) =>
		selectedCourseIds.includes(id),
	);
	const someSelectedOnPage = allOnPageIds.some((id: number) =>
		selectedCourseIds.includes(id),
	);

	const toggleAllOnPage = (checked: boolean) => {
		setSelectedCourseIds((prev: number[]) => {
			if (checked) {
				const set = new Set<number>(prev);
				for (const id of allOnPageIds) {
					set.add(id);
				}
				return Array.from(set);
			}
			return prev.filter((id: number) => !allOnPageIds.includes(id));
		});
	};

	const handleBatchUpdateCategory = async () => {
		if (!selectedCategory) {
			notifications.show({
				title: "Select a category",
				message: "Please choose a category to set",
				color: "yellow",
			});
			return;
		}
		if (selectedCourseIds.length === 0) {
			notifications.show({
				title: "No courses selected",
				message: "Select at least one course",
				color: "yellow",
			});
			return;
		}
		batchUpdateCourses({
			courseIds: selectedCourseIds,
			category: Number(selectedCategory),
		});
	};

	return (
		<Container size="xl" py="xl">
			<title>Courses | Admin | Paideia LMS</title>
			<meta name="description" content="Manage courses in Paideia LMS" />
			<meta property="og:title" content="Courses | Admin | Paideia LMS" />
			<meta property="og:description" content="Manage courses in Paideia LMS" />

			<Stack gap="lg">
				<Group justify="space-between">
					<div>
						<Title order={1}>Courses</Title>
						<Text c="dimmed" size="sm">
							Manage all courses in the system ({totalCourses} total)
						</Text>
					</div>
					<Button
						component={Link}
						to={href("/admin/course/new")}
						leftSection={<IconPlus size={16} />}
					>
						Add Course
					</Button>
				</Group>

				<Paper withBorder shadow="sm" p="md" radius="md">
					{selectedCourseIds.length > 0 && (
						<Group justify="space-between" mb="md">
							<Group gap="md">
								<Badge size="lg" variant="filled">
									{selectedCourseIds.length} selected
								</Badge>
								<Text size="sm" c="dimmed">
									Batch actions available
								</Text>
							</Group>
							<Menu position="bottom-end" withinPortal>
								<Menu.Target>
									<ActionIcon
										variant="light"
										size="lg"
										aria-label="Row actions"
									>
										<IconDots size={18} />
									</ActionIcon>
								</Menu.Target>
								<Menu.Dropdown>
									<Menu.Item onClick={() => setCategoryModalOpened(true)}>
										Change category
									</Menu.Item>
									<Menu.Item onClick={() => setStatusModalOpened(true)}>
										Change status
									</Menu.Item>
								</Menu.Dropdown>
							</Menu>
						</Group>
					)}
					<CourseSearchInput />

					<Box style={{ overflowX: "auto" }}>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>
										<Checkbox
											aria-label="Select all rows"
											checked={allSelectedOnPage}
											indeterminate={!allSelectedOnPage && someSelectedOnPage}
											onChange={(e) => toggleAllOnPage(e.currentTarget.checked)}
										/>
									</Table.Th>
									<Table.Th>Title</Table.Th>
									<Table.Th>Slug</Table.Th>
									<Table.Th>Description</Table.Th>
									<Table.Th>Category</Table.Th>
									<Table.Th>Status</Table.Th>
									<Table.Th>Created By</Table.Th>
									<Table.Th>Actions</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{courses.length === 0 ? (
									<Table.Tr>
										<Table.Td colSpan={7}>
											<Text ta="center" c="dimmed" py="xl">
												No courses found
											</Text>
										</Table.Td>
									</Table.Tr>
								) : (
									courses.map((course) => (
										<Table.Tr
											key={course.id}
											bg={
												selectedCourseIds.includes(course.id)
													? "var(--mantine-color-blue-light)"
													: undefined
											}
										>
											<Table.Td>
												<Checkbox
													aria-label="Select row"
													checked={selectedCourseIds.includes(course.id)}
													onChange={(event) =>
														setSelectedCourseIds(
															event.currentTarget.checked
																? [...selectedCourseIds, course.id]
																: selectedCourseIds.filter(
																		(id) => id !== course.id,
																	),
														)
													}
												/>
											</Table.Td>
											<Table.Td>
												<Text size="sm" fw={500}>
													{course.title}
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													{course.slug}
												</Text>
											</Table.Td>
											<Table.Td>
												<Text
													size="sm"
													lineClamp={2}
													style={{ maxWidth: "300px" }}
												>
													{course.description}
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													{course.categoryName}
												</Text>
											</Table.Td>
											<Table.Td>
												<Badge
													color={getStatusBadgeColor(course.status)}
													size="sm"
												>
													{getStatusLabel(course.status)}
												</Badge>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{course.createdBy}</Text>
											</Table.Td>
											<Table.Td>
												<Menu position="bottom-end">
													<Menu.Target>
														<ActionIcon variant="subtle">
															<IconDots size={18} />
														</ActionIcon>
													</Menu.Target>
													<Menu.Dropdown>
														<Menu.Item
															component={Link}
															to={href("/course/:id", {
																id: String(course.id),
															})}
															leftSection={<IconEye size={16} />}
														>
															View
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:id/settings", {
																id: String(course.id),
															})}
															leftSection={<IconSettings size={16} />}
														>
															Settings
														</Menu.Item>
														<Menu.Divider />
														<Menu.Item
															component={Link}
															to={href("/course/:id/modules", {
																id: String(course.id),
															})}
															leftSection={<IconFolder size={16} />}
														>
															Modules
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:id/participants", {
																id: String(course.id),
															})}
															leftSection={<IconUsers size={16} />}
														>
															Participants
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:id/grades", {
																id: String(course.id),
															})}
															leftSection={<IconReportAnalytics size={16} />}
														>
															Grades
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:id/backup", {
																id: String(course.id),
															})}
															leftSection={<IconDatabase size={16} />}
														>
															Backup
														</Menu.Item>
													</Menu.Dropdown>
												</Menu>
											</Table.Td>
										</Table.Tr>
									))
								)}
							</Table.Tbody>
						</Table>
					</Box>

					{totalPages > 1 && (
						<Group justify="center" mt="lg">
							<Pagination
								total={totalPages}
								value={currentPage}
								onChange={handlePageChange}
							/>
						</Group>
					)}
				</Paper>
				<Modal
					opened={categoryModalOpened}
					onClose={() => setCategoryModalOpened(false)}
					title="Change category"
					centered
				>
					<Stack>
						<Select
							placeholder="Select category"
							data={categories}
							value={selectedCategory}
							onChange={setSelectedCategory}
							clearable
						/>
						<Group justify="flex-end">
							<Button
								variant="default"
								onClick={() => setCategoryModalOpened(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={async () => {
									await handleBatchUpdateCategory();
									setCategoryModalOpened(false);
								}}
								loading={isLoading}
								disabled={isLoading}
							>
								Apply
							</Button>
						</Group>
					</Stack>
				</Modal>
				<Modal
					opened={statusModalOpened}
					onClose={() => setStatusModalOpened(false)}
					title="Change status"
					centered
				>
					<Stack>
						<Select
							placeholder="Select status"
							data={[
								{ value: "draft", label: "Draft" },
								{ value: "published", label: "Published" },
								{ value: "archived", label: "Archived" },
							]}
							value={selectedStatus}
							onChange={setSelectedStatus}
							clearable
						/>
						<Group justify="flex-end">
							<Button
								variant="default"
								onClick={() => setStatusModalOpened(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={async () => {
									if (!selectedStatus) {
										notifications.show({
											title: "Select a status",
											message: "Please choose a status to set",
											color: "yellow",
										});
										return;
									}
									if (selectedCourseIds.length === 0) {
										notifications.show({
											title: "No courses selected",
											message: "Select at least one course",
											color: "yellow",
										});
										return;
									}
									batchUpdateCourses({
										courseIds: selectedCourseIds,
										status: selectedStatus as Course["status"],
									});
									setStatusModalOpened(false);
								}}
								loading={isLoading}
								disabled={isLoading}
							>
								Apply
							</Button>
						</Group>
					</Stack>
				</Modal>
			</Stack>
		</Container>
	);
}
