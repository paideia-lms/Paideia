import type {
	GradebookSetupItem,
	GradebookSetupItemWithCalculations,
} from "../gradebook-management";

/**
 * Calculates adjusted weights for items using Moodle's weight distribution logic
 * - Items with specified weights use those weights
 * - Items without specified weights get equal shares of the remaining weight
 * - Total always equals 100% at each level (for non-extra-credit items)
 * - Extra credit items don't participate in weight distribution and allow categories to total above 100%
 */
export function calculateAdjustedWeights(
	items: GradebookSetupItem[],
): GradebookSetupItemWithCalculations[] {
	const result: GradebookSetupItemWithCalculations[] = [];

	// First, calculate adjusted weights for nested items in categories
	for (const item of items) {
		const processedItem: GradebookSetupItemWithCalculations = {
			...item,
			adjusted_weight: null,
			overall_weight: null,
			weight_explanation: null,
			grade_items: item.grade_items
				? calculateAdjustedWeights(item.grade_items)
				: undefined,
		};

		// Calculate adjusted weight for this item
		// Extra credit items don't participate in weight distribution
		const nonExtraCreditItems = items.filter(
			(item) => !(item.extra_credit ?? false),
		);

		// Only calculate weight distribution for non-extra-credit items
		// Separate items with specified weights and auto-weighted items (weight === null)
		const itemsWithWeight = nonExtraCreditItems.filter(
			(item) => item.weight !== null,
		);
		const autoWeightedItems = nonExtraCreditItems.filter(
			(item) => item.weight === null,
		);

		const totalSpecifiedWeight = itemsWithWeight.reduce(
			(sum, item) => sum + (item.weight ?? 0),
			0,
		);

		const remainingWeight = Math.max(0, 100 - totalSpecifiedWeight);
		const distributedWeightPerItem =
			autoWeightedItems.length > 0
				? remainingWeight / autoWeightedItems.length
				: 0;

		// Check if this item is extra credit
		const isExtraCredit = item.extra_credit ?? false;

		if (isExtraCredit) {
			// Extra credit items use their specified weight, but don't affect distribution
			// If no weight specified, use null (extra credit doesn't get auto-distributed)
			processedItem.adjusted_weight = item.weight;
		} else if (item.weight !== null) {
			// Non-extra-credit item with specified weight, use it as adjusted weight
			processedItem.adjusted_weight = item.weight;
		} else {
			// Non-extra-credit item without specified weight (auto-weighted), use distributed weight
			// If there are auto-weighted items and remaining weight > 0, distribute it
			// Otherwise, set to null (no weight available for distribution)
			processedItem.adjusted_weight =
				autoWeightedItems.length > 0 && distributedWeightPerItem > 0
					? distributedWeightPerItem
					: null;
		}

		result.push(processedItem);
	}

	return result;
}

/**
 * Calculates overall weight for all items in a gradebook structure
 * Effective weight = item_adjusted_weight * parent_category_adjusted_weight * ... * root_category_adjusted_weight
 * Only calculated for leaf items (not categories)
 * Example: If category is 35% and item is 10%, overall = 35% * 10% = 3.5%
 *
 * Returns totals: baseTotal, extraCreditTotal, and calculatedTotal (100 + extraCreditTotal)
 */
export function calculateOverallWeights(
	items: GradebookSetupItemWithCalculations[],
	rootItems?: GradebookSetupItemWithCalculations[],
): {
	baseTotal: number;
	extraCreditTotal: number;
	calculatedTotal: number;
	extraCreditItems: GradebookSetupItemWithCalculations[];
	totalMaxGrade: number;
} {
	// Use rootItems as the search scope, or default to items if not provided
	const searchScope = rootItems ?? items;

	// Helper function to find the direct parent category that contains an item
	const findContainingCategory = (
		itemId: number,
		searchItems: GradebookSetupItemWithCalculations[],
	): GradebookSetupItemWithCalculations | undefined => {
		for (const item of searchItems) {
			if (item.type === "category" && item.grade_items) {
				// Check if this category directly contains the item we're looking for
				if (item.grade_items.some((subItem) => subItem.id === itemId)) {
					return item;
				}
				// Recursively search nested categories - return the direct parent found
				const nestedResult = findContainingCategory(
					itemId,
					item.grade_items as GradebookSetupItemWithCalculations[],
				);
				if (nestedResult) {
					// Return the nested result (direct parent), not the outer category
					// The traversal up the tree will happen in the while loop
					return nestedResult;
				}
			}
		}
		return undefined;
	};

	// Process all items recursively
	for (const item of items) {
		if (item.type === "category") {
			// Categories don't have overall weight or explanation
			item.overall_weight = null;
			item.weight_explanation = null;

			// Recursively calculate overall weights for nested items if they exist
			if (item.grade_items) {
				calculateOverallWeights(
					item.grade_items as GradebookSetupItemWithCalculations[],
					searchScope,
				);
			}
		} else {
			// This is a leaf item, calculate overall weight
			if (item.adjusted_weight === null) {
				item.overall_weight = null;
				item.weight_explanation = null;
				continue;
			}

			// Find containing category in the root scope
			const containingCategory = findContainingCategory(item.id, searchScope);

			if (!containingCategory) {
				// Root-level item, overall weight equals adjusted weight
				item.overall_weight = item.adjusted_weight;
				item.weight_explanation = `${item.name} (${item.adjusted_weight.toFixed(2)}%) = ${item.adjusted_weight.toFixed(2)}%`;
				// console.log(`[calculateOverallWeights] Root item ${item.id} "${item.name}": adjusted_weight=${item.adjusted_weight}, overall_weight=${item.overall_weight}`);
				continue;
			}

			// console.log(`[calculateOverallWeights] Item ${item.id} "${item.name}": adjusted_weight=${item.adjusted_weight}, found in category ${containingCategory.id} "${containingCategory.name}"`);

			// Start with the item's adjusted weight as a decimal
			let overallWeight = item.adjusted_weight / 100;

			// Collect parent categories for explanation (from root to direct parent)
			const categoryChain: Array<{
				name: string;
				adjusted_weight: number | null;
			}> = [];

			// Multiply by all parent category adjusted weights
			let currentCategory: GradebookSetupItemWithCalculations | undefined =
				containingCategory;
			const visitedCategoryIds = new Set<number>();
			const maxDepth = 100; // Safety limit to prevent infinite loops
			let depth = 0;

			while (currentCategory && depth < maxDepth) {
				// Detect circular references
				if (visitedCategoryIds.has(currentCategory.id)) {
					console.error(
						`Circular reference detected in category hierarchy: category ${currentCategory.id} "${currentCategory.name}" was already visited`,
					);
					break;
				}

				visitedCategoryIds.add(currentCategory.id);
				depth++;

				categoryChain.unshift({
					name: currentCategory.name,
					adjusted_weight: currentCategory.adjusted_weight,
				});

				if (
					currentCategory.adjusted_weight !== null &&
					currentCategory.adjusted_weight !== undefined
				) {
					overallWeight *= currentCategory.adjusted_weight / 100;
				} else {
					// If category has no weight, assume 100% (no effect)
					overallWeight *= 1;
				}

				// Find parent category by traversing the tree
				currentCategory = findContainingCategory(
					currentCategory.id,
					searchScope,
				);
			}

			if (depth >= maxDepth) {
				console.error(
					`Maximum depth (${maxDepth}) reached while traversing category hierarchy. Possible circular reference or extremely deep nesting.`,
				);
			}

			// Convert back to percentage
			item.overall_weight = overallWeight * 100;

			// console.log(`[calculateOverallWeights] Item ${item.id} "${item.name}": calculated overall_weight=${item.overall_weight}, category chain: ${categoryChain.map(c => `${c.name}(${c.adjusted_weight ?? 'null'}%)`).join(' -> ')}`);

			// Build explanation string
			const explanationParts: string[] = [];

			// Add all parent categories
			for (const category of categoryChain) {
				const weightText =
					category.adjusted_weight !== null
						? `${category.adjusted_weight.toFixed(2)}%`
						: "100%";
				explanationParts.push(`${category.name} (${weightText})`);
			}

			// Add the item itself
			explanationParts.push(
				`${item.name} (${item.adjusted_weight.toFixed(2)}%)`,
			);

			// Combine with multiplication signs and add result
			const explanation = `${explanationParts.join(" × ")} = ${item.overall_weight.toFixed(2)}%`;

			item.weight_explanation = explanation;
		}
	}

	// Calculate totals from all leaf items
	const collectLeafItems = (
		items: GradebookSetupItemWithCalculations[],
	): GradebookSetupItemWithCalculations[] => {
		const leafItems: GradebookSetupItemWithCalculations[] = [];
		for (const item of items) {
			if (item.type === "category" && item.grade_items) {
				leafItems.push(...collectLeafItems(item.grade_items));
			} else {
				leafItems.push(item);
			}
		}
		return leafItems;
	};

	const allLeafItems = collectLeafItems(searchScope);

	// Separate base and extra credit items
	const baseItems = allLeafItems.filter(
		(item) => !(item.extra_credit === true),
	);
	const extraCreditItems = allLeafItems.filter(
		(item) => item.extra_credit === true && item.overall_weight !== null,
	);

	const baseTotal = baseItems.reduce(
		(sum, item) => sum + (item.overall_weight ?? 0),
		0,
	);
	const extraCreditTotal = extraCreditItems.reduce(
		(sum, item) => sum + (item.overall_weight ?? 0),
		0,
	);

	// Always use 100 + extraCreditTotal as the total, don't rely on baseTotal which may be wrong
	const calculatedTotal = 100 + extraCreditTotal;

	const totalMaxGrade = allLeafItems.reduce(
		(sum, item) => sum + (item.max_grade ?? 0),
		0,
	);

	return {
		baseTotal,
		extraCreditTotal,
		calculatedTotal,
		extraCreditItems,
		totalMaxGrade,
	};
}
