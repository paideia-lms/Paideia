import {
    Group,
    Paper,
    Stack,
    Text,
    Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDragDrop, IconFolder, IconFile, IconFolderOpen } from "@tabler/icons-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { href, useFetcher } from "react-router";
import {
    NodeApi,
    NodeRendererProps,
    Tree,
    TreeApi,
    SimpleTree,
} from "react-arborist";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { courseContextKey } from "server/contexts/course-context";
import { tryUpdateCourseStructure } from "server/internal/course-structure-management";
import { generateKeyBetween } from "server/utils/fractional-index";
import type { CourseStructure } from "server/utils/schema";
import { badRequest, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/course-structure-tree";

// Type definitions
interface TreeNode {
    id: string; // section: "section-${index}", item: "item-${moduleId}"
    name: string;
    children?: TreeNode[];
    data: {
        type: "section" | "item";
        position?: string; // fractional index
        moduleId?: number; // if type is item
        sectionData?: { title: string; description: string }; // if type is section
    };
}

interface ModuleLink {
    id: number;
    activityModule: {
        id: number;
        title: string;
        type: string;
        status: string;
    };
}

// Route types
interface RouteActionArgs {
    request: Request;
    context: {
        get: (key: unknown) => unknown;
    };
}

interface RouteClientActionArgs {
    serverAction: () => Promise<unknown>;
}

export const action = async ({ request, context }: Route.ActionArgs) => {
    const globalContext = context.get(globalContextKey);
    const userSession = context.get(userContextKey);
    const courseContext = context.get(courseContextKey);

    if (!userSession?.isAuthenticated) {
        return unauthorized({ error: "Unauthorized" });
    }

    if (!courseContext) {
        return badRequest({ error: "Course not found" });
    }

    const currentUser =
        userSession.effectiveUser || userSession.authenticatedUser;

    // Check permissions
    const canEdit =
        currentUser.role === "admin" ||
        currentUser.role === "content-manager" ||
        courseContext.course.createdBy.id === currentUser.id;

    if (!canEdit) {
        return unauthorized({
            error: "You don't have permission to edit this course structure",
        });
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "move") {
        const courseId = Number(formData.get("courseId"));
        const dragId = formData.get("dragId") as string;
        const parentId = formData.get("parentId") as string;
        const index = Number(formData.get("index"));

        if (Number.isNaN(courseId) || !dragId || !parentId || Number.isNaN(index)) {
            return badRequest({ error: "Invalid move parameters" });
        }

        // Get current structure and module links
        const currentStructure = courseContext.course.structure;
        const moduleLinks = courseContext.course.moduleLinks;

        // Transform to tree format, perform move, then transform back
        const treeData = structureToTreeData(currentStructure, moduleLinks);
        const tree = new SimpleTree(treeData);

        // Perform the move operation
        tree.move({
            id: dragId,
            parentId: parentId === "root" ? null : parentId,
            index,
        });

        // Calculate new position using fractional indexing
        const newTreeData = tree.data;
        const draggedNode = findNodeById(newTreeData, dragId);
        const siblings = getSiblings(newTreeData, parentId === "root" ? null : parentId);

        if (draggedNode && siblings.length > 0) {
            const draggedIndex = siblings.findIndex(sibling => sibling.id === dragId);
            const afterPosition = draggedIndex > 0 ? siblings[draggedIndex - 1].data.position : null;
            const beforePosition = draggedIndex < siblings.length - 1 ? siblings[draggedIndex + 1].data.position : null;

            const newPosition = generateKeyBetween(afterPosition, beforePosition);
            draggedNode.data.position = newPosition;
        }

        // Convert back to structure format
        const newStructure = treeDataToStructure(newTreeData);

        // Update the course structure
        const updateResult = await tryUpdateCourseStructure({
            payload: globalContext.payload,
            courseId,
            newStructure,
            user: {
                ...currentUser,
                avatar: currentUser.avatar?.id,
            },
            req: request,
            overrideAccess: false,
        });

        if (!updateResult.ok) {
            return badRequest({ error: updateResult.error.message });
        }

        return { success: true, message: "Structure updated successfully" };
    }

    return badRequest({ error: "Invalid intent" });
};

export async function clientAction({ serverAction }: RouteClientActionArgs) {
    const actionData = await serverAction();

    if (actionData && "success" in actionData && actionData.success) {
        notifications.show({
            title: "Success",
            message: actionData.message,
            color: "green",
        });
    } else if (actionData && "error" in actionData) {
        notifications.show({
            title: "Error",
            message: actionData.error,
            color: "red",
        });
    }
    return actionData;
}

// Custom hook for course structure tree
export function useCourseStructureTree() {
    const fetcher = useFetcher<typeof clientAction>();

    const moveNode = useCallback((
        courseId: number,
        dragId: string,
        parentId: string,
        index: number,
    ) => {
        fetcher.submit(
            {
                intent: "move",
                courseId: courseId.toString(),
                dragId,
                parentId,
                index: index.toString(),
            },
            { method: "POST", action: "/api/course-structure-tree" },
        );
    }, [fetcher]);

    return {
        moveNode,
        isLoading: fetcher.state === "submitting",
    };
}

// Utility functions for structure transformation
function structureToTreeData(structure: CourseStructure, moduleLinks: ModuleLink[]): TreeNode[] {
    const nodes: TreeNode[] = [];

    // Get all module IDs that are referenced in the structure
    const referencedModuleIds = new Set<number>();

    function collectModuleIds(items: Array<{ id: number } | { title: string; description: string; items?: any[] }>) {
        items.forEach(item => {
            if ('id' in item) {
                referencedModuleIds.add(item.id);
            } else if ('items' in item && item.items) {
                collectModuleIds(item.items);
            }
        });
    }

    structure.sections.forEach(section => {
        if (section.items) {
            collectModuleIds(section.items);
        }
    });


    // Create sections from structure
    structure.sections.forEach((section, sectionIndex) => {
        const sectionNode: TreeNode = {
            id: `section-${sectionIndex}`,
            name: section.title,
            children: [],
            data: {
                type: "section",
                position: generateKeyBetween(null, null),
                sectionData: {
                    title: section.title,
                    description: section.description,
                },
            },
        };

        // Add items to section - handle both items and nested sections
        if (section.items) {
            section.items.forEach((item, itemIndex) => {
                // Check if this is an item (has id) or a nested section (has title)
                if ('id' in item) {
                    // It's an item
                    const itemNode: TreeNode = {
                        id: `item-${item.id}`,
                        name: `Module ${item.id}`, // Will be replaced with actual module name
                        data: {
                            type: "item",
                            moduleId: item.id,
                            position: generateKeyBetween(null, null),
                        },
                    };
                    if (sectionNode.children) {
                        sectionNode.children.push(itemNode);
                    }
                } else if ('title' in item) {
                    // It's a nested section
                    const nestedSectionNode: TreeNode = {
                        id: `section-${sectionIndex}-${itemIndex}`,
                        name: item.title,
                        children: [],
                        data: {
                            type: "section",
                            position: generateKeyBetween(null, null),
                            sectionData: {
                                title: item.title,
                                description: item.description,
                            },
                        },
                    };
                    if (sectionNode.children) {
                        sectionNode.children.push(nestedSectionNode);
                    }
                }
            });
        }

        nodes.push(sectionNode);
    });

    console.log({ referencedModuleIds });

    // Create "Unsorted" folder for module links not in structure
    const unsortedModuleLinks = moduleLinks.filter(link => !referencedModuleIds.has(link.id));
    console.log({ unsortedModuleLinks });
    if (unsortedModuleLinks.length > 0) {
        const unsortedNode: TreeNode = {
            id: "unsorted",
            name: "Unsorted Modules",
            children: unsortedModuleLinks.map(link => ({
                id: `item-${link.id}`,
                name: link.activityModule.title,
                data: {
                    type: "item",
                    moduleId: link.id,
                    position: generateKeyBetween(null, null),
                },
            })),
            data: {
                type: "section",
                position: generateKeyBetween(null, null),
                sectionData: {
                    title: "Unsorted Modules",
                    description: "Module links that are not yet organized into course sections",
                },
            },
        };
        nodes.push(unsortedNode);
    }

    return nodes;
}

function treeDataToStructure(treeData: TreeNode[]): CourseStructure {
    const sections = treeData
        .filter(node => node.data.type === "section" && node.id !== "unsorted") // Exclude unsorted folder
        .map(sectionNode => ({
            title: sectionNode.data.sectionData?.title || "",
            description: sectionNode.data.sectionData?.description || "",
            items: sectionNode.children
                ?.map(child => {
                    if (child.data.type === "item") {
                        // It's an item
                        return { id: child.data.moduleId || 0 };
                    } else {
                        // It's a nested section
                        return {
                            title: child.data.sectionData?.title || "",
                            description: child.data.sectionData?.description || "",
                            items: child.children
                                ?.filter(grandChild => grandChild.data.type === "item")
                                .map(grandChild => ({ id: grandChild.data.moduleId || 0 })) || [],
                        };
                    }
                }) || [],
        }));

    return { sections };
}

function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

function getSiblings(nodes: TreeNode[], parentId: string | null): TreeNode[] {
    if (parentId === null) {
        return nodes;
    }

    const parent = findNodeById(nodes, parentId);
    return parent?.children || [];
}

// Tree node renderer component
function TreeNodeRenderer({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
    const isSection = node.data.data.type === "section";
    const isItem = node.data.data.type === "item";

    return (
        <div style={style} ref={dragHandle}>
            <Paper
                p="xs"
                radius="sm"
                style={{
                    cursor: "pointer",
                    backgroundColor: node.state.isSelected ? "var(--mantine-color-blue-1)" : undefined,
                }}
            >
                <Group gap="xs" wrap="nowrap">
                    {isSection ? (
                        <IconFolder size={16} color="var(--mantine-color-blue-6)" />
                    ) : (
                        <IconFile size={16} color="var(--mantine-color-gray-6)" />
                    )}
                    <Text size="sm" truncate>
                        {node.data.name}
                    </Text>
                    {isItem && (
                        <Tooltip label="Drag to reorder">
                            <IconDragDrop size={14} color="var(--mantine-color-gray-4)" />
                        </Tooltip>
                    )}
                </Group>
            </Paper>
        </div>
    );
}

// Main tree component
export function CourseStructureTree({
    structure,
    moduleLinks = [],
    readOnly = false,
    onStructureChange,
    courseId,
}: {
    structure: CourseStructure;
    moduleLinks?: ModuleLink[];
    readOnly?: boolean;
    onStructureChange?: (newStructure: CourseStructure) => void;
    courseId: number;
}) {
    const treeApiRef = useRef<TreeApi<TreeNode>>(null);
    const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
    const { moveNode } = useCourseStructureTree();

    // Transform structure to tree data
    const treeData = useMemo(() => {
        const nodes = structureToTreeData(structure, moduleLinks);

        // Update module names with actual data for all nodes (including unsorted)
        nodes.forEach(sectionNode => {
            if (sectionNode.children) {
                sectionNode.children.forEach(itemNode => {
                    const moduleLink = moduleLinks.find(link => link.id === itemNode.data.moduleId);
                    if (moduleLink) {
                        itemNode.name = moduleLink.activityModule.title;
                    }
                });
            }
        });

        return nodes;
    }, [structure, moduleLinks]);

    // Handle move operations
    const handleMove = useCallback(async (args: {
        dragIds: string[];
        dragNodes: NodeApi<TreeNode>[];
        parentId: string | null;
        parentNode: NodeApi<TreeNode> | null;
        index: number;
    }) => {
        if (readOnly) return;

        const draggedNode = args.dragNodes[0];
        const parentId = args.parentId || "root";

        // Optimistic update
        if (onStructureChange) {
            const tree = new SimpleTree(treeData);
            tree.move({
                id: draggedNode.id,
                parentId: args.parentId,
                index: args.index,
            });
            const newStructure = treeDataToStructure(tree.data);
            onStructureChange(newStructure);
        }

        // Submit to server
        moveNode(
            courseId,
            draggedNode.id,
            parentId,
            args.index,
        );
    }, [readOnly, treeData, onStructureChange, moveNode, courseId]);

    return (
        <Stack gap="sm">
            <Text size="sm" fw={500} c="dimmed">
                Course Structure
            </Text>
            <Paper withBorder radius="md" p="sm" style={{ height: 400, overflow: "hidden" }}>
                <Tree
                    data={treeData}
                    disableDrag={readOnly}
                    disableDrop={readOnly}
                    width="100%"
                    height={350}
                    ref={(ref) => {
                        if (ref) {
                            treeApiRef.current = ref;
                        }
                    }}
                    openByDefault={false}
                    disableMultiSelection={true}
                    onMove={handleMove}
                    onToggle={() => {
                        if (treeApiRef.current) {
                            setOpenNodes(treeApiRef.current.openState);
                        }
                    }}
                    initialOpenState={openNodes}
                    rowHeight={40}
                    overscanCount={10}
                >
                    {TreeNodeRenderer}
                </Tree>
            </Paper>
        </Stack>
    );
}
