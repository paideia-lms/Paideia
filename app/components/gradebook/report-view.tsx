import { Avatar, Badge, Group, Paper, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { getModuleIcon } from "../../utils/module-helper";
import { href, Link } from "react-router";

// ============================================================================
// Gradebook Report Types
// ============================================================================

type Enrollment = {
    id: number;
    name: string;
    email: string;
};

type GradebookJson = {
    gradebook_setup: {
        items: GradebookJsonItem[];
    };
};

export type GraderReportData = {
    enrollments: Enrollment[];
    gradebookJson: GradebookJson | null;
};

// ============================================================================
// Gradebook Report Helper Types and Functions
// ============================================================================

type GradebookJsonItem = {
    id: number;
    type: string;
    name: string;
    max_grade: number | null;
    grade_items?: GradebookJsonItem[];
    activityModuleLinkId?: number | null;
};

type HeaderCell = {
    id: number;
    name: string;
    type: string;
    colStart: number;
    colEnd: number;
    isCategory: boolean;
    activityModuleLinkId?: number;
};

type HeaderRow = {
    depth: number;
    cells: HeaderCell[];
};

type LeafItem = {
    id: number;
    name: string;
    type: string;
    maxGrade: number | null;
};

/**
 * Recursively counts only leaf items (actual grade items, not categories)
 * in a gradebook item structure.
 */
function countLeafItems(item: GradebookJsonItem): number {
    if (item.type !== "category" || !item.grade_items || item.grade_items.length === 0) {
        // This is a leaf item (not a category or category with no children)
        return 1;
    }

    // Count all leaf items in nested structure
    let count = 0;
    for (const child of item.grade_items) {
        count += countLeafItems(child);
    }
    return count;
}

/**
 * Recursively builds a flat list of all leaf items (actual grade items)
 * in the order they appear in the structure.
 */
function buildLeafItemsList(items: GradebookJsonItem[]): LeafItem[] {
    const result: LeafItem[] = [];

    for (const item of items) {
        if (item.type !== "category" || !item.grade_items || item.grade_items.length === 0) {
            // This is a leaf item
            result.push({
                id: item.id,
                name: item.name,
                type: item.type,
                maxGrade: item.max_grade,
            });
        } else {
            // This is a category with children - recursively process children
            const children = buildLeafItemsList(item.grade_items);
            result.push(...children);
        }
    }

    return result;
}

/**
 * Gets the color for a grade item type (matches setup-view.tsx)
 */
function getTypeColor(type: string): string {
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
}

/**
 * Recursively builds header rows for nested category structure.
 * Returns an array of header rows, where each row contains cells with colspan/rowspan.
 */
function buildHeaderRows(items: GradebookJsonItem[]): HeaderRow[] {
    // First, find the maximum depth to know how many rows we need
    const maxDepth = findMaxDepth(items, 0);
    const totalRows = maxDepth + 1;
    const rows: HeaderRow[] = Array.from({ length: totalRows }, (_, index) => ({
        depth: index,
        cells: []
    }));

    // Build headers recursively
    buildHeadersRecursive(items, rows, 0, 0);

    return rows;
}

/**
 * Finds the maximum depth of nesting in the gradebook structure.
 */
function findMaxDepth(items: GradebookJsonItem[], currentDepth: number): number {
    let maxDepth = currentDepth;

    for (const item of items) {
        if (item.type === "category" && item.grade_items && item.grade_items.length > 0) {
            const childDepth = findMaxDepth(item.grade_items, currentDepth + 1);
            maxDepth = Math.max(maxDepth, childDepth);
        }
    }

    return maxDepth;
}

/**
 * Recursively builds header cells, populating the rows array.
 * Each cell uses colStart and colEnd to position itself, with rowspan always 1.
 */
function buildHeadersRecursive(
    items: GradebookJsonItem[],
    rows: HeaderRow[],
    depth: number,
    columnStart: number,
): number {
    let currentColumn = columnStart;
    const finalRowIndex = rows.length - 1;

    for (const item of items) {
        const leafCount = countLeafItems(item);
        const isCategory = item.type === "category" && item.grade_items && item.grade_items.length > 0;

        if (isCategory) {
            // This is a category - it needs a header cell that spans its children
            // Add category header at current depth with colStart and colEnd
            rows[depth].cells.push({
                id: item.id,
                name: item.name,
                type: item.type,
                colStart: currentColumn,
                colEnd: currentColumn + leafCount,
                isCategory: true,
                activityModuleLinkId: item.activityModuleLinkId ?? undefined,
            } satisfies HeaderCell);

            // Recursively process children
            if (item.grade_items && item.grade_items.length > 0) {
                currentColumn = buildHeadersRecursive(
                    item.grade_items,
                    rows,
                    depth + 1,
                    currentColumn,
                );
            }
        } else {
            // This is a leaf item - always add to the final row
            rows[finalRowIndex].cells.push({
                id: item.id,
                name: item.name,
                type: item.type,
                colStart: currentColumn,
                colEnd: currentColumn + 1,
                isCategory: false,
                activityModuleLinkId: item.activityModuleLinkId ?? undefined,
            } satisfies HeaderCell);

            currentColumn += 1;
        }
    }

    return currentColumn;
}

export function GraderReportView({
    data,
}: {
    data: GraderReportData;
}) {
    const { enrollments, gradebookJson } = data;

    if (!gradebookJson) {
        return (
            <Paper withBorder p="xl">
                <Text c="dimmed" ta="center">
                    No gradebook has been set up for this course yet.
                </Text>
            </Paper>
        );
    }

    const { gradebook_setup } = gradebookJson;

    // Build flat list of all leaf items (actual grade items) in correct order
    const allItems = buildLeafItemsList(gradebook_setup.items);

    // Build hierarchical header structure
    const headerRows = buildHeaderRows(gradebook_setup.items);
    const totalColumns = allItems.length;

    // Helper to render cells for a row, handling gaps with empty cells
    const renderRowCells = (row: HeaderRow) => {
        // Sort cells by colStart
        const sortedCells = [...row.cells].sort((a, b) => a.colStart - b.colStart);

        const cells: React.ReactNode[] = [];
        let currentCol = 0;

        for (const cell of sortedCells) {
            // Fill gap before this cell with empty cells
            if (cell.colStart > currentCol) {
                for (let i = currentCol; i < cell.colStart; i++) {
                    cells.push(<Table.Th key={`empty-${i}`} rowSpan={1} />);
                }
            }

            // Render the actual cell
            const colspan = cell.colEnd - cell.colStart;
            const isLeafItem = !cell.isCategory;
            cells.push(
                <Table.Th
                    key={cell.id}
                    colSpan={colspan}
                    rowSpan={1}
                    style={{ minWidth: 150 }}
                >
                    <Stack gap={4}>
                        {isLeafItem && cell.activityModuleLinkId ? (
                            <Text size="sm" fw={cell.isCategory ? 600 : 500} component={Link} to={href("/course/module/:id", { id: cell.activityModuleLinkId.toString() })} style={{ cursor: "pointer" }}>
                                {cell.name}
                            </Text>
                        ) : (
                            <Text size="sm" fw={cell.isCategory ? 600 : 500}>
                                {cell.name}
                            </Text>
                        )}
                        {isLeafItem && (
                            <>
                                <Group gap="xs" wrap="nowrap">
                                    {["quiz", "assignment", "discussion"].includes(cell.type) &&
                                        getModuleIcon(cell.type as "quiz" | "assignment" | "discussion", 16)
                                    }
                                    <Badge color={getTypeColor(cell.type)} size="sm">
                                        {cell.type}
                                    </Badge>
                                </Group>
                                {cell.name && (
                                    <Text size="xs" c="dimmed">
                                        {(() => {
                                            const gradeItem = allItems.find(item => item.id === cell.id);
                                            return gradeItem?.maxGrade != null ? `/ ${gradeItem.maxGrade}` : "";
                                        })()}
                                    </Text>
                                )}
                            </>
                        )}
                    </Stack>
                </Table.Th>
            );

            currentCol = cell.colEnd;
        }

        // Fill remaining gap at the end
        if (currentCol < totalColumns) {
            for (let i = currentCol; i < totalColumns; i++) {
                cells.push(<Table.Th key={`empty-end-${i}`} rowSpan={1} />);
            }
        }

        return cells;
    };

    return (
        <Paper withBorder>
            <ScrollArea>
                <Table striped highlightOnHover stickyHeader withColumnBorders>
                    <Table.Thead>
                        {headerRows.map((row) => (
                            <Table.Tr key={`header-row-depth-${row.depth}`}>
                                {row.depth === 0 && (
                                    <Table.Th rowSpan={headerRows.length} style={{ minWidth: 200 }}>
                                        Student
                                    </Table.Th>
                                )}
                                {renderRowCells(row)}
                                <Table.Th rowSpan={1} style={{ minWidth: 100 }}>
                                    {row.depth === 0 ? "Total" : ""}
                                </Table.Th>
                            </Table.Tr>
                        ))}
                    </Table.Thead>
                    <Table.Tbody>
                        {enrollments.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={allItems.length + 2}>
                                    <Text c="dimmed" ta="center" py="xl">
                                        No active students enrolled in this course.
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            enrollments.map((enrollment: (typeof enrollments)[number]) => (
                                <Table.Tr key={enrollment.id}>
                                    <Table.Td>
                                        <Group gap="sm">
                                            <Avatar size="sm" radius="xl" color="blue">
                                                {enrollment.name.charAt(0)}
                                            </Avatar>
                                            <div>
                                                <Text size="sm" fw={500}>
                                                    {enrollment.name}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    {enrollment.email}
                                                </Text>
                                            </div>
                                        </Group>
                                    </Table.Td>
                                    {allItems.map((item) => (
                                        <Table.Td key={item.id}>
                                            <Text size="sm" c="dimmed">
                                                -
                                            </Text>
                                        </Table.Td>
                                    ))}
                                    <Table.Td>
                                        <Text size="sm" fw={500}>
                                            -
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </Paper>
    );
}

