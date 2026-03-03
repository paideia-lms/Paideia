import type {
	ActivityModuleSummary,
	CourseStructure,
	CourseStructureSection,
} from "server/internal/course-section-management";

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
export function convertCourseStructureToFlatData(
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
				if (parentNode?.children && !parentNode.children.includes(sectionId)) {
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
			if (parentNode?.children && !parentNode.children.includes(sectionId)) {
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
	flatData.root = rootNode;

	// Process root sections
	courseStructure.sections.forEach((section) => {
		processSection(section, "root");
	});

	return flatData;
}

// Get children IDs for a given item
export function getChildrenIds(
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

	const sourceItem = dragIds[0]!;

	const _isInTargetSection = getChildrenFn(targetId ?? "root").some(
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
			const firstItemInRoot = getChildrenFn("root")[0]!;
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

	// console.log(getChildren, adjacentItem, adjacentItem2, isInTargetSection);
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
			const lastItemInRoot = children[children.length - 1]!;
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

	// console.log(sourceType, sourceId, targetType, targetIdNum, location);
	return {
		sourceType,
		sourceId,
		targetType,
		targetId: targetIdNum,
		location,
	};
}
