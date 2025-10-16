import {
    dragAndDropFeature,
    expandAllFeature,
    hotkeysCoreFeature,
    selectionFeature,
    syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { ActionIcon, Badge, Box, Paper, Text } from "@mantine/core";
import { useIsFirstRender } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
    IconArrowsMaximize,
    IconArrowsMinimize,
    IconFolder,
    IconFolderOpen,
    IconGripVertical,
    IconLibraryMinus,
    IconLibraryPlus,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type {
    ActivityModuleSummary,
    CourseStructure,
    CourseStructureSection,
} from "server/internal/course-section-management";
import { useUpdateCourseStructure } from "~/routes/api/course-structure-tree";

// Tree node interface for headless-tree
export interface TreeNode {
    /**
     * the module link id prefixed with "m"
     * the section id prefixed with "s"
     */
    id: string;
    name: string;
    type: "section" | "module";
    contentOrder?: number;
    module?: ActivityModuleSummary;
    children?: string[];
}

// Convert course structure to flat data for headless-tree
function convertCourseStructureToFlatData(
    courseStructure: CourseStructure,
): Record<string, TreeNode> {
    const flatData: Record<string, TreeNode> = {};

    function processSection(
        section: CourseStructureSection,
        parentId?: string,
    ): string {
        const sectionId = `s${section.id}`;

        // Check if this section already exists (avoid duplicates)
        if (flatData[sectionId]) {
            // If it exists, just add it to the parent's children if needed
            if (parentId && parentId !== "root") {
                const parentNode = flatData[parentId];
                if (
                    parentNode &&
                    parentNode.children &&
                    !parentNode.children.includes(sectionId)
                ) {
                    parentNode.children.push(sectionId);
                }
            }
            return sectionId;
        }

        const sectionNode: TreeNode = {
            id: sectionId,
            name: section.title,
            type: "section",
            contentOrder: section.contentOrder,
            children: [],
        };
        flatData[sectionId] = sectionNode;

        // Add this section as a child to its parent
        if (parentId) {
            const parentNode = flatData[parentId];
            if (
                parentNode &&
                parentNode.children &&
                !parentNode.children.includes(sectionId)
            ) {
                parentNode.children.push(sectionId);
            }
        }

        // Process content items
        section.content.forEach((item) => {
            if (item.type === "section") {
                processSection(item, sectionId);
            } else if (item.type === "activity-module") {
                const moduleId = `m${item.id}`;
                const moduleNode: TreeNode = {
                    id: moduleId,
                    name: item.module.title,
                    type: "module",
                    contentOrder: item.contentOrder,
                    module: item.module,
                };
                flatData[moduleId] = moduleNode;

                // Add module as child to this section
                sectionNode.children!.push(moduleId);
            }
        });

        return sectionId;
    }

    // Create root container
    const rootNode: TreeNode = {
        id: "root",
        name: "Root",
        type: "section",
        children: [],
    };
    flatData["root"] = rootNode;

    // Process root sections
    courseStructure.sections.forEach((section) => {
        processSection(section, "root");
    });

    return flatData;
}

// Get children IDs for a given item
function getChildrenIds(
    itemId: string,
    flatData: Record<string, TreeNode>,
): string[] {
    const item = flatData[itemId];
    return item?.children || [];
}

// Calculate move operation from drag and drop parameters
export function calculateMoveOperation(
    {
        dragIds,
        targetId,
        targetInsertionIndex,
        targetChildIndex,
    }: {
        dragIds: string[];
        targetId: string | null;
        targetInsertionIndex: number | undefined;
        targetChildIndex: number | undefined;
    },
    getChildrenFn: (itemId: string) => string[],
): {
    sourceType: "section" | "activity-module";
    sourceId: number;
    targetType: "section" | "activity-module";
    targetId: number;
    location: "above" | "below" | "inside";
} | null {
    if (dragIds.length > 1) {
        return null; // Multiple item move not supported
    }

    const sourceItem = dragIds[0];

    const isInTargetSection = getChildrenFn(targetId ?? "root").some(
        (item) => item === sourceItem,
    );

    // Parse source
    let sourceType: "section" | "activity-module";
    let sourceId: number;

    if (sourceItem.startsWith("s")) {
        sourceType = "section";
        sourceId = Number(sourceItem.substring(1));
    } else {
        sourceType = "activity-module";
        sourceId = Number(sourceItem.substring(1));
    }

    // Determine location based on headless-tree target information
    // The key insight is that we need to interpret the target information correctly.
    // targetId tells us the item that was the drop target.
    // targetInsertionIndex tells us where in that item's children to insert (0 = beginning, > length = end)
    // targetChildIndex is used when dropping directly on an item

    let targetType: "section" | "activity-module";
    let targetIdNum: number;
    let location: "above" | "below" | "inside";

    const targetIndex = targetInsertionIndex ?? targetChildIndex;
    // if targetIndex is undefined, we know the location is "inside" and target must be section
    if (targetIndex === undefined) {
        if (targetId === null || targetId === "root") {
            // in this case, we just move to the first item of root section
            const firstItemInRoot = getChildrenFn("root")[0];
            return {
                sourceType,
                sourceId,
                targetType: "section",
                targetId: Number(firstItemInRoot.substring(1)),
                location: "inside",
            };
        }

        // now we know that it is not root and it must be a section
        // we can directly use the target id

        return {
            sourceType,
            sourceId,
            targetType: "section",
            targetId: Number(targetId.substring(1)),
            location: "inside",
        };
    }

    // target index is defined, meaning we are moving at the drag line between two items
    // get the adjacent item at the target index
    const getChildren = getChildrenFn(targetId ?? "root").filter(
        (item) => item !== sourceItem,
    );
    const adjacentItem = getChildren[targetIndex - 1];
    const adjacentItem2 = getChildren[targetIndex];

    console.log(getChildren, adjacentItem, adjacentItem2, isInTargetSection);

    // if adjacentItem is defined, use it and location is below
    if (adjacentItem) {
        targetType = adjacentItem.startsWith("s") ? "section" : "activity-module";
        targetIdNum = Number(adjacentItem.substring(1));
        location = "below";
    } else if (adjacentItem2) {
        targetType = adjacentItem2.startsWith("s") ? "section" : "activity-module";
        targetIdNum = Number(adjacentItem2.substring(1));
        location = "above";
    } else {
        // move in the section itself
        if (targetId === null || targetId === "root") {
            // get the last item in the root section
            const children = getChildrenFn("root").filter(
                (item) => item !== sourceItem,
            );
            const lastItemInRoot = children[children.length - 1];
            targetType = "section";
            targetIdNum = Number(lastItemInRoot.substring(1));
            location = "below";
        } else {
            // it must be a section and we can directly use the target id
            targetType = "section";
            targetIdNum = Number(targetId.substring(1));
            location = "inside";
        }
    }

    console.log(sourceType, sourceId, targetType, targetIdNum, location);

    return {
        sourceType,
        sourceId,
        targetType,
        targetId: targetIdNum,
        location,
    };
}

// Get status color for modules
function getStatusColor(status: string) {
    switch (status) {
        case "published":
            return "green";
        case "draft":
            return "yellow";
        case "archived":
            return "gray";
        default:
            return "blue";
    }
}

// Get module type icon
function getModuleIcon(type: string) {
    switch (type) {
        case "page":
            return "📄";
        case "assignment":
            return "📝";
        case "quiz":
            return "❓";
        case "discussion":
            return "💬";
        case "whiteboard":
            return "🎨";
        default:
            return "📄";
    }
}

interface CourseStructureTreeProps {
    readOnly?: boolean;
    courseId: number;
    courseStructure: CourseStructure;
}

export function CourseStructureTree({
    readOnly = false,
    courseId,
    courseStructure,
}: CourseStructureTreeProps) {
    const { updateCourseStructure, isLoading } = useUpdateCourseStructure();
    const isFirstRender = useIsFirstRender();
    const flatData = convertCourseStructureToFlatData(courseStructure);

    const tree = useTree<TreeNode>({
        rootItemId: "root",
        getItemName: (item) => item.getItemData().name,
        isItemFolder: (item) => item.getItemData().type === "section",
        canReorder: !readOnly,
        onDrop: async (items, target) => {
            const dragIds = items.map((i) => i.getId());

            if (dragIds.length > 1) {
                notifications.show({
                    title: "Error",
                    message: "Only single item move is supported",
                    color: "red",
                });
                return;
            }
            const sourceItem = dragIds[0]; // Assuming single item move for now
            const targetId =
                target.item.getId() === "root" ? null : target.item.getId();
            const targetInsertionIndex =
                "insertionIndex" in target
                    ? (target.insertionIndex as number)
                    : undefined;
            const targetChildIndex =
                "childIndex" in target ? (target.childIndex as number) : undefined;

            console.log(
                "Moving items:",
                dragIds,
                "to",
                targetId,
                "at index",
                targetInsertionIndex,
                "and child index",
                targetChildIndex,
            );

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
            const targetName =
                targetType === "section"
                    ? flatData[`s${targetIdNum}`]?.name
                    : flatData[`m${targetIdNum}`]?.module?.title;

            console.log(
                "sourceType:",
                sourceType,
                "sourceId:",
                sourceId,
                "targetType:",
                targetType,
                "targetId:",
                targetIdNum,
                "targetName:",
                targetName,
                "location:",
                location,
            );

            try {
                await updateCourseStructure({
                    courseId: courseId,
                    sourceId: sourceId,
                    sourceType: sourceType,
                    targetId: targetIdNum,
                    targetType: targetType,
                    location,
                });
            } catch (error) {
                console.error("Failed to update course structure:", error);
            }
        },
        indent: 20,
        dataLoader: {
            getItem: (itemId: string) => flatData[itemId],
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

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        if (isLoading || isFirstRender) return;
        tree.rebuildTree();
    }, [isLoading]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        tree.expandAll();
    }, []);

    return (
        <Paper withBorder p="md" style={{ height: "100%" }}>
            <Box
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                }}
            >
                <Text size="lg" fw={600}>
                    Course Structure
                </Text>
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
                    <ActionIcon
                        variant="light"
                        size="sm"
                        aria-label="Collapse all"
                        onClick={() => tree.rebuildTree()}
                    >
                        <IconLibraryMinus stroke={1.5} />
                    </ActionIcon>
                </ActionIcon.Group>
            </Box>

            <Box>
                <div {...tree.getContainerProps()}>
                    {tree.getItems().map((item) => {
                        const itemData = item.getItemData();
                        const isSection = itemData.type === "section";
                        const isModule = itemData.type === "module";

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
                                        : "transparent",
                                    border: item.isDragTarget()
                                        ? "2px dashed var(--mantine-color-blue-6)"
                                        : "none",
                                }}
                            >
                                <ActionIcon
                                    size="xs"
                                    variant="transparent"
                                    style={{ cursor: "grab" }}
                                >
                                    <IconGripVertical size={12} />
                                </ActionIcon>

                                {isSection && (
                                    <>
                                        {item.isExpanded() ? (
                                            <IconFolderOpen
                                                size={16}
                                                color="var(--mantine-color-blue-6)"
                                            />
                                        ) : (
                                            <IconFolder
                                                size={16}
                                                color="var(--mantine-color-blue-6)"
                                            />
                                        )}
                                        <Text size="sm" fw={500}>
                                            {itemData.name}
                                        </Text>
                                    </>
                                )}

                                {isModule && itemData.module && (
                                    <>
                                        <Text size="sm">{getModuleIcon(itemData.module.type)}</Text>
                                        <Text size="sm" style={{ flex: 1 }}>
                                            {itemData.name}
                                        </Text>
                                        <Badge
                                            size="xs"
                                            color={getStatusColor(itemData.module.status)}
                                            variant="light"
                                        >
                                            {itemData.module.status}
                                        </Badge>
                                    </>
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
