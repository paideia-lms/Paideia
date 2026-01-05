import {
	ActionIcon,
	AppShell,
	Box,
	Container,
	Grid,
	Tooltip,
	Button, Group, Paper, Text
} from "@mantine/core";
import { useDisclosure, useClickOutside, useIsFirstRender } from "@mantine/hooks";
import {
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { Outlet } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";

import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-content-layout";
import { typeCreateLoader } from "app/utils/loader-utils";
import {
	dragAndDropFeature,
	expandAllFeature,
	hotkeysCoreFeature,
	selectionFeature,
	syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { notifications } from "@mantine/notifications";
import {
	IconChevronDown,
	IconChevronRight,
	IconGripVertical,
	IconLibraryMinus,
	IconLibraryPlus,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { Link } from "react-router";
import { useUpdateCourseStructure } from "~/routes/api/course-structure-tree";
import { getModuleIcon } from "~/utils/module-helper";
import { calculateMoveOperation, convertCourseStructureToFlatData, getChildrenIds, type TreeNode } from "app/utils/course-structure-tree-utils";
import { getRouteUrl } from "app/utils/search-params-utils";



const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const { pageInfo } = context.get(globalContextKey);
	const courseContext = context.get(courseContextKey);
	const userSession = context.get(userContextKey);

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found");
	}
	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("User not authenticated");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const currentItemId = pageInfo.is["routes/course/section.$id"]
		? `s${pageInfo.is["routes/course/section.$id"].params.sectionId}`
		: pageInfo.is["layouts/course-module-layout"]
			? `m${pageInfo.is["layouts/course-module-layout"].params.moduleLinkId}`
			: undefined;

	return {
		course: courseContext.course,
		courseStructure: courseContext.courseStructure,
		courseStructureTree: courseContext.courseStructureTree,
		courseStructureTreeSimple: courseContext.courseStructureTreeSimple,
		currentUser: currentUser,
		pageInfo: pageInfo,
		enrolment: courseContext.enrolment,
		canEdit: courseContext.permissions.canUpdateStructure.allowed,
		params,
		currentItemId,
	};
})!;

interface CourseStructureTreeProps {
	readOnly?: boolean;
	courseId: number;
	courseStructure: Route.ComponentProps["loaderData"]["courseStructure"];
	currentItemId?: string;
	canSeeStatus?: boolean;
}

function CourseStructureTree({
	readOnly = false,
	courseId,
	courseStructure,
	currentItemId,
	canSeeStatus = false,
}: CourseStructureTreeProps) {
	const { submit: updateCourseStructure, isLoading } =
		useUpdateCourseStructure();
	const isFirstRender = useIsFirstRender();
	const flatData = convertCourseStructureToFlatData(courseStructure);
	const ref = useClickOutside(() => {
		tree.setSelectedItems([]);
	});

	const tree = useTree<TreeNode>({
		rootItemId: "root",
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => item.getItemData().type === "section",
		canReorder: !readOnly,
		canDrop: readOnly ? () => false : undefined,
		canDrag: readOnly ? () => false : undefined,
		onDrop: async (items, target) => {
			if (readOnly) return;
			const dragIds = items.map((i) => i.getId());

			if (dragIds.length > 1) {
				notifications.show({
					title: "Error",
					message: "Only single item move is supported",
					color: "red",
				});
				return;
			}
			const _sourceItem = dragIds[0]; // Assuming single item move for now
			const targetId =
				target.item.getId() === "root" ? null : target.item.getId();
			const targetInsertionIndex =
				"insertionIndex" in target
					? (target.insertionIndex as number)
					: undefined;
			const targetChildIndex =
				"childIndex" in target ? (target.childIndex as number) : undefined;

			// console.log(
			// 	"Moving items:",
			// 	dragIds,
			// 	"to",
			// 	targetId,
			// 	"at index",
			// 	targetInsertionIndex,
			// 	"and child index",
			// 	targetChildIndex,
			// );

			const moveOperation = calculateMoveOperation(
				{ dragIds, targetId, targetInsertionIndex, targetChildIndex },
				(itemId) => getChildrenIds(itemId, flatData),
			);

			if (!moveOperation) {
				notifications.show({
					title: "Error",
					message: "Only single item move is supported",
					color: "red",
				});
				return;
			}

			const {
				sourceType,
				sourceId,
				targetType,
				targetId: targetIdNum,
				location,
			} = moveOperation;
			const _targetName =
				targetType === "section"
					? flatData[`s${targetIdNum}`]?.name
					: flatData[`m${targetIdNum}`]?.module?.title;

			// console.log(
			// 	"sourceType:",
			// 	sourceType,
			// 	"sourceId:",
			// 	sourceId,
			// 	"targetType:",
			// 	targetType,
			// 	"targetId:",
			// 	targetIdNum,
			// 	"targetName:",
			// 	targetName,
			// 	"location:",
			// 	location,
			// );

			await updateCourseStructure({
				values: {
					courseId: courseId,
					sourceId: sourceId,
					sourceType: sourceType,
					targetId: targetIdNum,
					targetType: targetType,
					location,
				},
			}).catch((error) => {
				console.error("Failed to update course structure:", error);
			});
		},
		indent: 20,
		dataLoader: {
			getItem: (itemId: string) => {
				// ! we need to provide a defualt value for now because the getChildren does not revalidate the data when the flatData changes
				return (
					flatData[itemId] ?? {
						id: itemId,
						name: itemId,
						type: "section",
						children: [],
					}
				);
			},
			getChildren: (itemId: string) => getChildrenIds(itemId, flatData),
		},
		features: [
			syncDataLoaderFeature,
			selectionFeature,
			hotkeysCoreFeature,
			dragAndDropFeature,
			expandAllFeature,
		],
	});

	const items = tree.getItems();

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (isLoading || isFirstRender) return;
		tree.rebuildTree();
	}, [isLoading, JSON.stringify(flatData)]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		tree.expandAll();
	}, []);

	return (
		<Paper withBorder p="md" style={{ height: "100%" }} ref={ref}>
			<Box
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "16px",
				}}
			>
				<Group>
					<Text size="lg" fw={600}>
						Course Structure
					</Text>
					<Button
						size="compact-xs"
						component={Link}
						to={getRouteUrl("/course/:courseId", { params: { courseId: courseId.toString() } })}
						variant="light"
					>
						Root
					</Button>
				</Group>
				<ActionIcon.Group>
					<ActionIcon
						variant="light"
						size="sm"
						aria-label="Expand all"
						onClick={() => tree.expandAll()}
					>
						<IconLibraryPlus stroke={1.5} />
					</ActionIcon>
					<ActionIcon
						variant="light"
						size="sm"
						aria-label="Collapse all"
						onClick={() => tree.collapseAll()}
					>
						<IconLibraryMinus stroke={1.5} />
					</ActionIcon>
				</ActionIcon.Group>
			</Box>

			<Box>
				<div {...tree.getContainerProps()}>
					{items.map((item) => {
						const itemData = item.getItemData();
						const isSection = itemData.type === "section";
						const isModule = itemData.type === "module";

						const isCurrentItem = itemData.id === currentItemId;

						return (
							<Box
								{...item.getProps()}
								key={item.getId()}
								style={{
									marginLeft: `${item.getItemMeta().level * 20}px`,
									display: "flex",
									alignItems: "center",
									gap: "8px",
									padding: "4px 8px",
									cursor: "pointer",
									borderRadius: "4px",
									backgroundColor: item.isSelected()
										? "var(--mantine-color-blue-1)"
										: isCurrentItem
											? "var(--mantine-color-gray-1)"
											: "transparent",
									border: item.isDragTarget()
										? "2px dashed var(--mantine-color-blue-6)"
										: "none",
								}}
							>
								{!readOnly && (
									<ActionIcon
										size="xs"
										variant="transparent"
										style={{ cursor: "grab" }}
									>
										<IconGripVertical size={12} />
									</ActionIcon>
								)}

								{isSection && (
									<>
										<ActionIcon
											size="xs"
											variant="transparent"
											onClick={(e) => {
												e.stopPropagation();
												if (item.isExpanded()) {
													item.collapse();
												} else {
													item.expand();
												}
											}}
											style={{ cursor: "pointer" }}
											aria-label={
												item.isExpanded()
													? "Collapse section"
													: "Expand section"
											}
										>
											{item.isExpanded() ? (
												<IconChevronDown size={12} />
											) : (
												<IconChevronRight size={12} />
											)}
										</ActionIcon>
										{/* {item.isExpanded() ? (
                                            <IconFolderOpen
                                                size={16}
                                                color="var(--mantine-color-blue-6)"
                                            />
                                        ) : (
                                            <IconFolder
                                                size={16}
                                                color="var(--mantine-color-blue-6)"
                                            />
                                        )} */}
										<Link
											to={`/course/section/${itemData.id.substring(1)}`}
											style={{
												textDecoration: "none",
												color: "inherit",
												flex: 1,
												width: "100%",
											}}
											onClick={(e) => e.stopPropagation()}
										>
											<Text
												size="sm"
												fw={isCurrentItem ? 600 : 400}
												style={{ cursor: "pointer", flex: 1 }}
											>
												{itemData.name}
											</Text>
										</Link>
									</>
								)}

								{isModule && itemData.module && (
									<Link
										to={`/course/module/${itemData.id.substring(1)}`}
										style={{
											display: "flex",
											alignItems: "center",
											gap: "8px",
											flex: 1,
											textDecoration: "none",
											color: "inherit",
										}}
									>
										<Text size="sm">
											{getModuleIcon(itemData.module.type, 12)}
										</Text>
										<Text
											size="sm"
											fw={isCurrentItem ? 600 : 400}
											style={{ flex: 1 }}
										>
											{itemData.name}
										</Text>
									</Link>
								)}
							</Box>
						);
					})}
					<div
						style={{
							...tree.getDragLineStyle(),
							backgroundColor: "var(--mantine-color-blue-6)",
							height: "2px",
						}}
						className="dragline"
					/>
				</div>
			</Box>
		</Paper>
	);
}


export default function CourseContentLayout({
	loaderData,
}: Route.ComponentProps) {
	const {
		course,
		courseStructure,
		canEdit,
		currentItemId,
	} = loaderData;

	const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(true);

	return (
		<Container size="xl" p="xs">
			<AppShell>
				<AppShell.Main>
					<Grid columns={24}>
						<Grid.Col span={navbarOpened ? 8 : 1}>
							<Box p="xs">
								<Tooltip label="Toggle sidebar">
									<ActionIcon variant="light" onClick={toggleNavbar}>
										{navbarOpened ? (
											<IconLayoutSidebarLeftCollapse />
										) : (
											<IconLayoutSidebarLeftExpand />
										)}
									</ActionIcon>
								</Tooltip>
								{navbarOpened && (
									<CourseStructureTree
										currentItemId={currentItemId}
										readOnly={!canEdit}
										courseId={course.id}
										courseStructure={courseStructure}
										canSeeStatus={canEdit}
									/>
								)}
							</Box>
						</Grid.Col>
						<Grid.Col span={navbarOpened ? 16 : 23}>
							<Outlet />
						</Grid.Col>
					</Grid>
				</AppShell.Main>
			</AppShell>
		</Container>
	);
}
