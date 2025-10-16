import { useState, useMemo } from "react";
import {
    dragAndDropFeature,
    hotkeysCoreFeature,
    selectionFeature,
    syncDataLoaderFeature,
    type TreeState,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Box, Text, ActionIcon, Badge, Paper } from "@mantine/core";
import { IconFolder, IconFolderOpen, IconGripVertical } from "@tabler/icons-react";

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
    children?: TreeNode[];
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
            section.children.forEach((childSection) => {
                processSection(childSection);
            });
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
}

export function CourseStructureTree({
    readOnly = false,
}: CourseStructureTreeProps) {
    const [state, setState] = useState<Partial<TreeState<TreeNode>>>({
        expandedItems: ["section-1", "section-2"],
        selectedItems: [],
    });

    const [flatData, setFlatData] = useState<Record<string, TreeNode>>(() =>
        convertToFlatData(mockCourseData)
    );

    // Create data loader functions that have access to current state
    const dataLoader = useMemo(() => ({
        getItem: (itemId: string) => flatData[itemId],
        getChildren: (itemId: string) => {
            if (itemId === "root") {
                // Return root sections
                return Object.values(flatData)
                    .filter(item => item.type === "section" &&
                        !Object.values(flatData).some(s =>
                            s.type === "section" && s.section?.children?.some(c => c.id === item.id)
                        )
                    )
                    .map(item => item.id);
            }
            return getChildrenIds(itemId, flatData);
        },
    }), [flatData]);

    const tree = useTree<TreeNode>({
        state,
        setState,
        rootItemId: "root",
        getItemName: (item) => item.getItemData().name,
        isItemFolder: (item) => item.getItemData().type === "section",
        canReorder: !readOnly,
        onDrop: (items, target) => {
            console.log("Drop:", { items, target });

            setFlatData(prevFlatData => {
                const newFlatData = { ...prevFlatData };

                // Handle the drop logic based on item types and target
                items.forEach(item => {
                    const itemData = item.getItemData();

                    if (itemData.type === "module") {
                        // Moving a module - need to update its parent section
                        const currentModule = itemData.module;
                        if (currentModule) {
                            // Find current parent section
                            const currentParentSection = Object.values(newFlatData).find(section =>
                                section.type === "section" &&
                                section.section?.modules?.some(m => m.id === currentModule.id)
                            );

                            if (currentParentSection?.section) {
                                // Remove from current parent
                                currentParentSection.section.modules = currentParentSection.section.modules.filter(
                                    m => m.id !== currentModule.id
                                );

                                // Add to new parent or handle as top-level if dropped on root
                                if (target.item.getId() === "root") {
                                    // For now, we'll handle root drops differently
                                    // You might want to create a default section or handle this case
                                    console.log("Module dropped on root - implement logic for this case");
                                } else {
                                    const newParentSection = newFlatData[target.item.getId()];
                                    if (newParentSection && newParentSection.type === "section" && newParentSection.section) {
                                        newParentSection.section.modules.push(currentModule);
                                    }
                                }
                            }
                        }
                    } else if (itemData.type === "section") {
                        // Moving a section - need to update parent-child relationships
                        const currentSection = itemData.section;
                        if (currentSection) {
                            // Find current parent section
                            const currentParentSection = Object.values(newFlatData).find(section =>
                                section.type === "section" &&
                                section.section?.children?.some(c => c.id === currentSection.id)
                            );

                            if (currentParentSection?.section) {
                                // Remove from current parent
                                currentParentSection.section.children = currentParentSection.section.children?.filter(
                                    c => c.id !== currentSection.id
                                );

                                // Add to new parent
                                if (target.item.getId() === "root") {
                                    // Section is now a root level section
                                    console.log("Section moved to root level");
                                } else {
                                    const newParentSection = newFlatData[target.item.getId()];
                                    if (newParentSection && newParentSection.type === "section" && newParentSection.section) {
                                        if (!newParentSection.section.children) {
                                            newParentSection.section.children = [];
                                        }
                                        newParentSection.section.children.push(currentSection);
                                    }
                                }
                            }
                        }
                    }
                });

                return newFlatData;
            });
        },
        indent: 20,
        dataLoader,
        features: [
            syncDataLoaderFeature,
            selectionFeature,
            hotkeysCoreFeature,
            dragAndDropFeature,
        ],
    });

    return (
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
                            <Box
                                {...item.getProps()}
                                key={item.getId()}
                                style={{
                                    paddingLeft: `${item.getItemMeta().level * 20}px`,
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
                    <div style={tree.getDragLineStyle()} className="dragline" />
                </div>
            </Box>
        </Paper>
    );
}