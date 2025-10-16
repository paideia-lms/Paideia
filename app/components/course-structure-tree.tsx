import { useEffect, useState } from "react";
import {
    dragAndDropFeature,
    hotkeysCoreFeature,
    selectionFeature,
    expandAllFeature,
    syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Box, Text, ActionIcon, Badge, Paper } from "@mantine/core";
import { IconFolder, IconFolderOpen, IconGripVertical, IconArrowsMaximize, IconArrowsMinimize, IconLibraryMinus, IconLibraryPlus } from "@tabler/icons-react";
import { useUpdateCourseStructure } from "~/routes/api/course-structure-tree";
import type { CourseStructure, CourseStructureSection, ActivityModuleSummary } from "server/internal/course-section-management";
import { useIsFirstRender } from "@mantine/hooks";

// Tree node interface for headless-tree
interface TreeNode {
    id: string;
    name: string;
    type: "section" | "module";
    contentOrder?: number;
    order?: number;
    module?: ActivityModuleSummary;
    children?: string[];
}

// Convert course structure to flat data for headless-tree
function convertCourseStructureToFlatData(courseStructure: CourseStructure): Record<string, TreeNode> {
    const flatData: Record<string, TreeNode> = {};

    function processSection(section: CourseStructureSection, parentId?: string): string {
        const sectionId = `s${section.id}`;

        // Check if this section already exists (avoid duplicates)
        if (flatData[sectionId]) {
            // If it exists, just add it to the parent's children if needed
            if (parentId && parentId !== "root") {
                const parentNode = flatData[parentId];
                if (parentNode && parentNode.children && !parentNode.children.includes(sectionId)) {
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
            order: section.order,
            children: [],
        };
        flatData[sectionId] = sectionNode;

        // Add this section as a child to its parent
        if (parentId) {
            const parentNode = flatData[parentId];
            if (parentNode && parentNode.children && !parentNode.children.includes(sectionId)) {
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
function getChildrenIds(itemId: string, flatData: Record<string, TreeNode>): string[] {
    const item = flatData[itemId];
    return item?.children || [];
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
            const dragIds = items.map(i => i.getId());
            const targetId = target.item.getId() === "root" ? null : target.item.getId();

            // Get the insertion index from the target
            const targetIndex = 'insertionIndex' in target ? (target.insertionIndex as number) :
                'childIndex' in target ? (target.childIndex as number) : 0;

            console.log("Moving items:", dragIds, "to", targetId, "at index", targetIndex);

            // Convert tree IDs back to actual database IDs and determine move operation
            const sourceItem = dragIds[0]; // Assuming single item move for now
            const targetItem = targetId;

            // Parse IDs to determine source and target types and actual IDs
            let sourceType: "section" | "activity-module";
            let sourceId: number;
            let targetType: "section" | "activity-module";
            let targetIdNum: number | null;

            if (sourceItem.startsWith("s")) {
                sourceType = "section";
                sourceId = Number(sourceItem.substring(1));
            } else {
                sourceType = "activity-module";
                sourceId = Number(sourceItem.substring(1));
            }

            if (targetItem === null) {
                targetType = "section";
                targetIdNum = null; // Moving to root level
            } else if (targetItem.startsWith("s")) {
                targetType = "section";
                targetIdNum = Number(targetItem.substring(1));
            } else {
                targetType = "activity-module";
                targetIdNum = Number(targetItem.substring(1));
            }

            // Determine location based on target context
            let location: "above" | "below" | "inside";
            if (targetIndex === 0 || targetId === null) {
                location = "inside";
            } else if ('insertionIndex' in target) {
                location = "above";
            } else {
                location = "below";
            }

            try {
                await updateCourseStructure({
                    courseId: courseId,
                    sourceId: sourceId,
                    sourceType: sourceType,
                    targetId: targetIdNum || 0,
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
        tree.rebuildTree()
    }, [isLoading]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        tree.expandAll()
    }, []);

    return (
        <Paper withBorder p="md" style={{ height: "100%" }}>
            <Box style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
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
                </ActionIcon.Group>
            </Box>

            <Box >
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
                                    backgroundColor: item.isSelected() ? "var(--mantine-color-blue-1)" : "transparent",
                                    border: item.isDragTarget() ? "2px dashed var(--mantine-color-blue-6)" : "none",
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
                                            <IconFolderOpen size={16} color="var(--mantine-color-blue-6)" />
                                        ) : (
                                            <IconFolder size={16} color="var(--mantine-color-blue-6)" />
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
                    <div style={{
                        ...tree.getDragLineStyle(),
                        backgroundColor: "var(--mantine-color-blue-6)",
                        height: "2px",
                    }} className="dragline" />
                </div>
            </Box>
        </Paper>
    );
}