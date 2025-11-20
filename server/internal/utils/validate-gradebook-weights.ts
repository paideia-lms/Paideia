import { WeightExceedsLimitError } from "~/utils/error";
import type { GradebookSetupItem } from "../gradebook-management";

/**
 * Validates weight distribution at a level (course level or category level)
 * Rules:
 * 1. Filter away extra credit items from the level
 * 2. If auto-weighted items (weight === null) exist in the level, then total of weight items must be <= 100%
 * 3. If auto-weighted items don't exist in the level, then total weight must equal exactly 100%
 * 4. Recursively validates nested categories
 *
 * @param items - Array of gradebook setup items to validate
 * @param levelName - Name of the level being validated (e.g., "course level", "course level > Category 1")
 * @param errorMessagePrefix - Prefix for error messages (e.g., "Operation", "Item creation")
 * @throws WeightExceedsLimitError if validation fails
 */
export function validateGradebookWeights(
	items: GradebookSetupItem[],
	levelName: string,
	errorMessagePrefix: string = "Operation",
): void {
	// Filter away extra credit items
	const nonExtraCreditItems = items.filter(
		(item) => !(item.extra_credit ?? false),
	);

	// If no non-extra-credit items at this level, skip validation
	if (nonExtraCreditItems.length === 0) {
		// Still need to recursively validate categories
		for (const item of items) {
			if (item.type === "category" && item.grade_items) {
				const categoryName = `${levelName} > ${item.name}`;
				validateGradebookWeights(item.grade_items, categoryName, errorMessagePrefix);
			}
		}
		return;
	}

	// Separate items with specified weights and auto-weighted items
	const itemsWithWeight = nonExtraCreditItems.filter(
		(item) => item.weight !== null,
	);
	const autoWeightedItems = nonExtraCreditItems.filter(
		(item) => item.weight === null,
	);

	// Calculate total of specified weights
	const totalSpecifiedWeight = itemsWithWeight.reduce(
		(sum, item) => sum + (item.weight ?? 0),
		0,
	);

	const tolerance = 0.01;

	if (autoWeightedItems.length > 0) {
		// If auto-weighted items exist, specified weights must be <= 100%
		if (totalSpecifiedWeight > 100 + tolerance) {
			throw new WeightExceedsLimitError(
				`${errorMessagePrefix} would result in total specified weight of ${totalSpecifiedWeight.toFixed(2)}% at ${levelName}. When auto-weighted items exist, specified weights must not exceed 100%.`,
			);
		}
	} else {
		// If no auto-weighted items, total must equal exactly 100%
		if (Math.abs(totalSpecifiedWeight - 100) > tolerance) {
			throw new WeightExceedsLimitError(
				`${errorMessagePrefix} would result in total weight of ${totalSpecifiedWeight.toFixed(2)}% at ${levelName}. Total must equal exactly 100%.`,
			);
		}
	}

	// Recursively validate categories
	for (const item of items) {
		if (item.type === "category" && item.grade_items) {
			const categoryName = `${levelName} > ${item.name}`;
			validateGradebookWeights(item.grade_items, categoryName, errorMessagePrefix);
		}
	}
}

