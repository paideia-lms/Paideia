import { courseContextKey } from "server/contexts/course-context";
import type { Route } from "./+types/course-content-layout";

import { AppShell, Grid, Box, Text, Badge, Paper } from "@mantine/core";
import { IconFolder, IconFolderOpen } from "@tabler/icons-react";
import { Outlet } from "react-router";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import { globalContextKey } from "server/contexts/global-context";
import { useState } from "react";
import {
    dragAndDropFeature,
    hotkeysCoreFeature,
    selectionFeature,
    syncDataLoaderFeature,
    type TreeState,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
export const loader = async ({ context }: Route.LoaderArgs) => {
    const { pageInfo } = context.get(globalContextKey);
    const courseContext = context.get(courseContextKey);
    const enrolmentContext = context.get(enrolmentContextKey);
    const userSession = context.get(userContextKey);

    if (!courseContext) {
        throw new ForbiddenResponse("Course not found");
    }
    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("User not authenticated");
    }

    const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

    return {
        course: courseContext.course,
        currentUser: currentUser,
        pageInfo: pageInfo,
        enrolment: enrolmentContext?.enrolment,
    };
};

// Mock data structure for sections and modules
interface CourseModule {
    id: string;
    title: string;
    type: "page" | "assignment" | "quiz" | "discussion" | "whiteboard";
    status: "draft" | "published" | "archived";
}

interface CourseSection {
    id: string;
    title: string;
    description?: string;
    modules: CourseModule[];
    children?: CourseSection[];
}

interface TreeNode {
    id: string;
    name: string;
    type: "section" | "module";
    module?: CourseModule;
    section?: CourseSection;
}

// Mock data
const mockCourseData: CourseSection[] = [
    {
        id: "section-1",
        title: "Introduction",
        description: "Getting started with the course",
        modules: [
            {
                id: "module-1",
                title: "Welcome to the Course",
                type: "page",
                status: "published",
            },
            {
                id: "module-2",
                title: "Course Overview",
                type: "page",
                status: "published",
            },
        ],
        children: [
            {
                id: "section-1-1",
                title: "Prerequisites",
                description: "What you need to know",
                modules: [
                    {
                        id: "module-3",
                        title: "Required Knowledge",
                        type: "page",
                        status: "draft",
                    },
                ],
            },
        ],
    },
    {
        id: "section-2",
        title: "Core Concepts",
        description: "Main learning content",
        modules: [
            {
                id: "module-4",
                title: "Assignment 1: Basic Concepts",
                type: "assignment",
                status: "published",
            },
            {
                id: "module-5",
                title: "Quiz: Understanding Check",
                type: "quiz",
                status: "published",
            },
        ],
        children: [
            {
                id: "section-2-1",
                title: "Advanced Topics",
                description: "Deeper dive into concepts",
                modules: [
                    {
                        id: "module-6",
                        title: "Discussion: Real-world Applications",
                        type: "discussion",
                        status: "published",
                    },
                ],
            },
        ],
    },
    {
        id: "section-3",
        title: "Assessment",
        description: "Final evaluation",
        modules: [
            {
                id: "module-7",
                title: "Final Project",
                type: "assignment",
                status: "draft",
            },
        ],
    },
];

// Convert mock data to flat structure for headless-tree
function convertToFlatData(sections: CourseSection[]): Record<string, TreeNode> {
    const flatData: Record<string, TreeNode> = {};

    function processSection(section: CourseSection) {
        const sectionNode: TreeNode = {
            id: section.id,
            name: section.title,
            type: "section",
            section,
        };
        flatData[section.id] = sectionNode;

        // Add modules as children
        section.modules.forEach((module) => {
            const moduleNode: TreeNode = {
                id: module.id,
                name: module.title,
                type: "module",
                module,
            };
            flatData[module.id] = moduleNode;
        });

        // Process child sections
        if (section.children) {
            for (const childSection of section.children) {
                processSection(childSection);
            }
        }
    }

    for (const section of sections) {
        processSection(section);
    }
    return flatData;
}

// Get children IDs for a given item
function getChildrenIds(itemId: string, flatData: Record<string, TreeNode>): string[] {
    const children: string[] = [];

    // Find modules that belong to this section
    Object.values(flatData).forEach((item) => {
        if (item.type === "module" && item.module) {
            // Check if this module belongs to the section
            const section = Object.values(flatData).find(s =>
                s.type === "section" && s.section?.modules.some(m => m.id === item.id)
            );
            if (section?.id === itemId) {
                children.push(item.id);
            }
        }

        // Find child sections
        if (item.type === "section" && item.section) {
            const parentSection = Object.values(flatData).find(s =>
                s.type === "section" && s.section?.children?.some(c => c.id === item.id)
            );
            if (parentSection?.id === itemId) {
                children.push(item.id);
            }
        }
    });

    return children;
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

// Update hierarchical data structure when items are moved
function updateHierarchicalData(
    sections: CourseSection[],
    dragItems: string[],
    targetSectionId: string | null,
    targetIndex: number
): CourseSection[] {
    // Deep clone the sections
    const updatedSections = JSON.parse(JSON.stringify(sections)) as CourseSection[];

    // Find and remove dragged items from their current locations
    const removedItems: {
        item: TreeNode;
        fromSection: string;
        isSection: boolean;
        originalIndex: number;
    }[] = [];

    function removeFromSection(sectionList: CourseSection[], parentId?: string) {
        for (let i = 0; i < sectionList.length; i++) {
            const section = sectionList[i];

            // Remove modules
            const moduleIndex = section.modules.findIndex(m => dragItems.includes(m.id));
            if (moduleIndex !== -1) {
                const module = section.modules[moduleIndex];
                removedItems.push({
                    item: {
                        id: module.id,
                        name: module.title,
                        type: "module",
                        module: module
                    },
                    fromSection: parentId || section.id,
                    isSection: false,
                    originalIndex: moduleIndex
                });
                section.modules.splice(moduleIndex, 1);
            }

            // Remove sections
            if (dragItems.includes(section.id)) {
                removedItems.push({
                    item: {
                        id: section.id,
                        name: section.title,
                        type: "section",
                        section: section
                    },
                    fromSection: parentId || "root",
                    isSection: true,
                    originalIndex: i
                });
                sectionList.splice(i, 1);
                i--; // Adjust index after removal
            }

            // Recursively check child sections
            if (section.children) {
                removeFromSection(section.children, section.id);
            }
        }
    }

    removeFromSection(updatedSections);

    // Add items to their new location
    function addToSection(sectionList: CourseSection[], targetId: string | null, index: number) {
        if (!targetId) {
            // Adding to root level - add sections
            for (const removedItem of removedItems) {
                if (removedItem.isSection && removedItem.item.section) {
                    sectionList.splice(index, 0, removedItem.item.section);
                    index++; // Increment for next item
                }
            }
            return;
        }

        for (const section of sectionList) {
            if (section.id === targetId) {
                // Add modules to this section
                for (const removedItem of removedItems) {
                    if (!removedItem.isSection && removedItem.item.type === "module" && removedItem.item.module) {
                        section.modules.splice(index, 0, removedItem.item.module);
                        index++; // Increment for next item
                    }
                }
                return;
            }

            // Check child sections
            if (section.children) {
                addToSection(section.children, targetId, index);
            }
        }
    }

    addToSection(updatedSections, targetSectionId, targetIndex);

    return updatedSections;
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

export default function CourseContentLayout(_: Route.ComponentProps) {
    const [state, setState] = useState<Partial<TreeState<TreeNode>>>({
        expandedItems: ["section-1", "section-2"],
        selectedItems: [],
    });

    const [treeData, setTreeData] = useState(() => {
        const data = convertToFlatData(mockCourseData);
        console.log("Initial tree data:", data);
        return data;
    });

    const tree = useTree<TreeNode>({
        state,
        setState,
        rootItemId: "root",
        getItemName: (item) => item.getItemData().name,
        isItemFolder: (item) => item.getItemData().type === "section",
        canReorder: true,
        onDrop: (items, target) => {
            console.log("Drop:", { items, target });

            const dragIds = items.map(i => i.getId());
            const targetId = target.item.getId() === "root" ? null : target.item.getId();

            // Get the insertion index from the target
            const targetIndex = 'insertionIndex' in target ? (target.insertionIndex as number) :
                'childIndex' in target ? (target.childIndex as number) : 0;

            console.log("Moving items:", dragIds, "to", targetId, "at index", targetIndex);

            // Update the hierarchical data
            const updatedSections = updateHierarchicalData(mockCourseData, dragIds, targetId, targetIndex);

            // Convert to flat data and update state
            const newFlatData = convertToFlatData(updatedSections);
            console.log("Updated flat data:", newFlatData);

            setTreeData(newFlatData);
        },
        indent: 20,
        dataLoader: {
            getItem: (itemId) => {
                console.log("getItem:", treeData);
                const item = treeData[itemId];
                if (!item) {
                    console.warn(`Item not found: ${itemId}`);
                    // Return a placeholder item instead of null
                    return {
                        id: itemId,
                        name: `Missing: ${itemId}`,
                        type: "section" as const,
                    };
                }
                return item;
            },
            getChildren: (itemId) => {
                if (itemId === "root") {
                    // Return root sections
                    const rootSections = Object.values(treeData)
                        .filter(item => item.type === "section" &&
                            !Object.values(treeData).some(s =>
                                s.type === "section" && s.section?.children?.some(c => c.id === item.id)
                            )
                        )
                        .map(item => item.id);
                    console.log("Root sections:", rootSections);
                    return rootSections;
                }
                const children = getChildrenIds(itemId, treeData);
                console.log(`Children of ${itemId}:`, children);
                return children;
            },
        },
        features: [
            syncDataLoaderFeature,
            selectionFeature,
            hotkeysCoreFeature,
            dragAndDropFeature,
        ],
    });

    return (
        <AppShell>
            <AppShell.Main>
                <Grid>
                    <Grid.Col span={4}>
                        <Paper withBorder p="md" style={{ height: "100%" }}>
                            <Text size="lg" fw={600} mb="md">
                                Course Structure
                            </Text>

                            <Box style={{ height: "calc(100vh - 200px)", overflow: "auto" }}>
                                <div {...tree.getContainerProps()} style={{ height: "100%" }}>
                                    {tree.getItems().map((item) => {
                                        const itemData = item.getItemData();
                                        const isSection = itemData.type === "section";
                                        const isModule = itemData.type === "module";

                                        return (
                                            <div
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
                                            </div>
                                        );
                                    })}
                                    <div style={tree.getDragLineStyle()} className="dragline" />
                                </div>
                            </Box>
                        </Paper>
                    </Grid.Col>
                    <Grid.Col span={8}>
                        <Outlet />
                    </Grid.Col>
                </Grid>
            </AppShell.Main>
        </AppShell>
    );
}