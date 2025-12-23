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
