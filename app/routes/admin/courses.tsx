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
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { href } from "react-router";
import {
	IconDatabase,
	IconDots,
	IconEye,
	IconFolder,
	IconInfoCircle,
	IconPlus,
	IconReportAnalytics,
	IconSearch,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { parseAsInteger, parseAsString } from "nuqs";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type CategoryTreeNode,
	tryGetCategoryTree,
} from "server/internal/course-category-management";
import { tryFindAllCourses } from "server/internal/course-management";
import type { Course } from "server/payload-types";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "~/components/course-view-utils";
import { ForbiddenResponse } from "~/utils/responses";
import { useBatchUpdateCourses } from "../api/batch-update-courses";
import type { Route } from "./+types/courses";
import { typeCreateLoader } from "app/utils/loader-utils";
import { useNuqsSearchParams } from "~/utils/search-params-utils";

// Define search params
export const loaderSearchParams = {
	query: parseAsString.withDefault(""),
	page: parseAsInteger.withDefault(1),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, searchParams, params }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
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
	const { query, page } = searchParams;

	// Fetch courses with search and pagination
	const coursesResult = await tryFindAllCourses({
		payload,
		query: query || undefined,
		limit: 10,
		page,
		sort: "-createdAt",
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to get courses");
	});

	// categories for batch update select
	const categoriesResult = await tryGetCategoryTree({
		payload,
		req: payloadRequest,
	});
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

	const courses = coursesResult.docs.map((course) => {
		const createdBy = course.createdBy;
		const createdByName =
			createdBy !== null
				? `${createdBy.firstName || ""} ${createdBy.lastName || ""}`.trim() ||
				createdBy.email
				: "Unknown";

		const category = course.category;
		const categoryName = category ? category.name : "-";

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
		totalCourses: coursesResult.totalDocs,
		totalPages: coursesResult.totalPages,
		currentPage: coursesResult.page,
		categories: flatCategories,
		searchParams, params
	};
});

type CourseSearchInputProps = {
	query: string;
};

function CourseSearchInput({ query }: CourseSearchInputProps) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);
	const [input, setInput] = useState(query || "");

	useEffect(() => {
		setInput(query || "");
	}, [query]);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		setQueryParams({ query: value || null });
	}, 500);

	return (
		<TextInput
			placeholder='Search... e.g. status:published category:123 category:none category:"computer science"'
			leftSection={<IconSearch size={16} />}
			value={input}
			onChange={(e) => {
				const v = e.currentTarget.value;
				setInput(v);
				debouncedSetQuery(v);
			}}
			mb="md"
			label={
				<Group gap="xs" wrap="nowrap" align="center">
					<Text>Search</Text>
					<Tooltip
						withArrow
						multiline
						w={360}
						label={
							<div>
								<Text size="xs">
									Free text matches title, description, slug. You can also use
									filters:
								</Text>
								<Text size="xs">- status:published</Text>
								<Text size="xs">- category:123 (by ID)</Text>
								<Text size="xs">- category:none (uncategorized)</Text>
								<Text size="xs">
									- category:&quot;computer science&quot; (by name, partial
									match)
								</Text>
							</div>
						}
					>
						<IconInfoCircle size={14} />
					</Tooltip>
				</Group>
			}
		/>
	);
}

export default function CoursesPage({ loaderData }: Route.ComponentProps) {
	const { courses, totalCourses, totalPages, currentPage, categories, searchParams } =
		loaderData;
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);

	// Handle page change
	const handlePageChange = (newPage: number) => {
		setQueryParams({ page: newPage });
	};

	const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [categoryModalOpened, setCategoryModalOpened] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
	const [statusModalOpened, setStatusModalOpened] = useState(false);
	const { submit: batchUpdateCourses, isLoading } = useBatchUpdateCourses();

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
			values: {
				courseIds: selectedCourseIds,
				category: Number(selectedCategory),
			},
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
					<CourseSearchInput query={searchParams.query} />

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
															to={href("/course/:courseId", {
																courseId: String(course.id),
															})}
															leftSection={<IconEye size={16} />}
														>
															View
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:courseId/settings", {
																courseId: String(course.id),
															})}
															leftSection={<IconSettings size={16} />}
														>
															Settings
														</Menu.Item>
														<Menu.Divider />
														<Menu.Item
															component={Link}
															to={href("/course/:courseId/modules", {
																courseId: String(course.id),
															})}
															leftSection={<IconFolder size={16} />}
														>
															Modules
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:courseId/participants", {
																courseId: String(course.id),
															})}
															leftSection={<IconUsers size={16} />}
														>
															Participants
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:courseId/grades", {
																courseId: String(course.id),
															})}
															leftSection={<IconReportAnalytics size={16} />}
														>
															Grades
														</Menu.Item>
														<Menu.Item
															component={Link}
															to={href("/course/:courseId/backup", {
																courseId: String(course.id),
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
								value={currentPage ?? undefined}
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
										values: {
											courseIds: selectedCourseIds,
											status: selectedStatus as Course["status"],
										},
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
