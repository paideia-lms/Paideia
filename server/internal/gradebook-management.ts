import type { Payload } from "payload";
import { Gradebooks } from "server/payload.config";
import { assertZodInternal, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	DuplicateGradebookError,
	GradebookNotFoundError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Gradebook } from "../payload-types";
import { buildCategoryStructure } from "./build-gradebook-structure";
import type { CategoryData, ItemData } from "./build-gradebook-structure";

export interface CreateGradebookArgs {
	courseId: number;
	enabled?: boolean;
}

export interface UpdateGradebookArgs {
	enabled?: boolean;
}

export interface SearchGradebooksArgs {
	courseId?: number;
	enabled?: boolean;
	limit?: number;
	page?: number;
}

export interface GradebookSetupItem {
	/**
	 *  either category id or item id
	 */
	id: number;
	type:
	| "manual_item"
	| "category"
	| "page"
	| "whiteboard"
	| "assignment"
	| "quiz"
	| "discussion";
	name: string;
	weight: number | null;
	max_grade: number | null;
	grade_items?: GradebookSetupItem[];
}

export interface GradebookSetupItemWithCalculations extends GradebookSetupItem {
	adjusted_weight: number | null;
	overall_weight: number | null; // Only for leaf items
	weight_explanation: string | null; // Human-readable explanation of overall weight calculation
	grade_items?: GradebookSetupItemWithCalculations[];
}

export interface GradebookSetup {
	items: GradebookSetupItem[];
	exclude_empty_grades: boolean;
}

export interface GradebookSetupForUI {
	gradebook_id: number;
	course_id: number;
	gradebook_setup: {
		items: GradebookSetupItemWithCalculations[];
		exclude_empty_grades: boolean;
	};
}

export interface GradebookJsonRepresentation {
	gradebook_id: number;
	course_id: number;
	gradebook_setup: GradebookSetup;
}

/**
 * Creates a new gradebook for a course using Payload local API
 */
export const tryCreateGradebook = Result.wrap(
	async (payload: Payload, request: Request, args: CreateGradebookArgs) => {
		const { courseId, enabled = true } = args;

		// Check if course exists
		const course = await payload.findByID({
			collection: "courses",
			id: courseId,
			req: request,
		});

		if (!course) {
			throw new Error(`Course with ID ${courseId} not found`);
		}

		// Check if gradebook already exists for this course
		const existingGradebook = await payload.find({
			collection: Gradebooks.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			limit: 1,
			req: request,
		});

		if (existingGradebook.docs.length > 0) {
			throw new DuplicateGradebookError(
				`Gradebook already exists for course ${courseId}`,
			);
		}

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const newGradebook = await payload.create({
				collection: Gradebooks.slug,
				data: {
					course: courseId,
					enabled,
				},
				req: { ...request, transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const gradebookCourse = newGradebook.course;
			assertZodInternal(
				"tryCreateGradebook: Gradebook course is required",
				gradebookCourse,
				z.object({
					id: z.number(),
				}),
			);

			const result = {
				...newGradebook,
				course: gradebookCourse,
			};
			return result;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) => {
		if (error instanceof DuplicateGradebookError) {
			return error;
		}
		return new Error(
			`Failed to create gradebook: ${error instanceof Error ? error.message : String(error)}`,
		);
	},
);

/**
 * Updates an existing gradebook using Payload local API
 */
export const tryUpdateGradebook = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		gradebookId: number,
		args: UpdateGradebookArgs,
	) => {
		// Check if gradebook exists
		const existingGradebook = await payload.findByID({
			collection: Gradebooks.slug,
			id: gradebookId,
			req: request,
		});

		if (!existingGradebook) {
			throw new GradebookNotFoundError(
				`Gradebook with ID ${gradebookId} not found`,
			);
		}

		const updatedGradebook = await payload.update({
			collection: Gradebooks.slug,
			id: gradebookId,
			data: args,
			req: request,
		});

		return updatedGradebook as Gradebook;
	},
	(error) =>
		new Error(
			`Failed to update gradebook: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a gradebook by ID
 */
export const tryFindGradebookById = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
		const gradebook = await payload.findByID({
			collection: Gradebooks.slug,
			id: gradebookId,
		});

		if (!gradebook) {
			throw new GradebookNotFoundError(
				`Gradebook with ID ${gradebookId} not found`,
			);
		}

		return gradebook as Gradebook;
	},
	(error) =>
		new Error(
			`Failed to find gradebook by ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a gradebook by course ID
 */
export const tryFindGradebookByCourseId = Result.wrap(
	async (payload: Payload, courseId: number) => {
		const gradebook = await payload.find({
			collection: Gradebooks.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			limit: 1,
		});

		if (gradebook.docs.length === 0) {
			throw new GradebookNotFoundError(
				`Gradebook not found for course ${courseId}`,
			);
		}

		return gradebook.docs[0] as Gradebook;
	},
	(error) =>
		new Error(
			`Failed to find gradebook by course ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

// ! we should not delete gradebooks so we don't have the delete function here

/**
 * Gets gradebook with all categories and items
 */
export const tryGetGradebookWithDetails = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
		const gradebook = await payload.findByID({
			collection: Gradebooks.slug,
			id: gradebookId,
			depth: 2, // Get categories and items with their details
		});

		if (!gradebook) {
			throw new GradebookNotFoundError(
				`Gradebook with ID ${gradebookId} not found`,
			);
		}

		return gradebook as Gradebook;
	},
	(error) =>
		new Error(
			`Failed to get gradebook with details: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Gets gradebook by course ID with all details
 */
export const tryGetGradebookByCourseWithDetails = Result.wrap(
	async (payload: Payload, courseId: number) => {
		const gradebook = await payload.find({
			collection: Gradebooks.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			depth: 2, // Get categories and items with their details
			limit: 1,
		});

		if (gradebook.docs.length === 0) {
			throw new GradebookNotFoundError(
				`Gradebook not found for course ${courseId}`,
			);
		}

		return gradebook.docs[0] as Gradebook;
	},
	(error) =>
		new Error(
			`Failed to get gradebook by course with details: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Calculates adjusted weights for items using Moodle's weight distribution logic
 * - Items with specified weights use those weights
 * - Items without specified weights get equal shares of the remaining weight
 * - Total always equals 100% at each level
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
		const itemsWithWeight = items.filter((item) => item.weight !== null);
		const itemsWithoutWeight = items.filter((item) => item.weight === null);

		const totalSpecifiedWeight = itemsWithWeight.reduce(
			(sum, item) => sum + (item.weight ?? 0),
			0,
		);

		const remainingWeight = Math.max(0, 100 - totalSpecifiedWeight);
		const distributedWeightPerItem =
			itemsWithoutWeight.length > 0 ? remainingWeight / itemsWithoutWeight.length : 0;

		if (item.weight !== null) {
			// Item has specified weight, use it as adjusted weight
			processedItem.adjusted_weight = item.weight;
		} else {
			// Item has no specified weight, use distributed weight
			processedItem.adjusted_weight =
				itemsWithoutWeight.length > 0 && distributedWeightPerItem > 0
					? distributedWeightPerItem
					: null;
		}

		result.push(processedItem);
	}

	return result;
}

/**
 * Calculates overall weight for all items in a gradebook structure
 * Overall weight = item_adjusted_weight * parent_category_adjusted_weight * ... * root_category_adjusted_weight
 * Only calculated for leaf items (not categories)
 * Example: If category is 35% and item is 10%, overall = 35% * 10% = 3.5%
 */
export function calculateOverallWeights(
	items: GradebookSetupItemWithCalculations[],
	rootItems?: GradebookSetupItemWithCalculations[],
): void {
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
				continue;
			}

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

			while (currentCategory) {
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
				currentCategory = findContainingCategory(currentCategory.id, searchScope);
			}

			// Convert back to percentage
			item.overall_weight = overallWeight * 100;

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
}

/**
 * Constructs a JSON representation of the gradebook structure
 */
export const tryGetGradebookJsonRepresentation = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
		// Get the gradebook to verify it exists and get course ID
		const gradebook = await payload.findByID({
			collection: Gradebooks.slug,
			id: gradebookId,
			depth: 0,
		});

		if (!gradebook) {
			throw new GradebookNotFoundError(
				`Gradebook with ID ${gradebookId} not found`,
			);
		}

		// Get course ID from gradebook
		const courseId = gradebook.course;
		assertZodInternal(
			"tryGetGradebookJsonRepresentation: Course is required",
			courseId,
			z.number(),
		);

		// Get all categories for this gradebook (depth 0 to avoid deep nesting)
		const categoriesPromise = payload
			.find({
				collection: "gradebook-categories",
				where: {
					gradebook: {
						equals: gradebookId,
					},
				},
				depth: 0,
				joins: {
					subcategories: {
						limit: MOCK_INFINITY,
					},
					items: {
						limit: MOCK_INFINITY,
					},
				},
				pagination: false,
				sort: "sortOrder",
			})
			.then((c) => {
				const categories = c.docs;

				return categories.map((category) => {
					const parent = category.parent;
					assertZodInternal(
						"tryGetGradebookJsonRepresentation: Parent is required",
						parent,
						z.number().nullish(),
					);
					const subcategories = category.subcategories?.docs ?? [];
					assertZodInternal(
						"tryGetGradebookJsonRepresentation: Subcategories are required",
						subcategories,
						z.array(z.number()),
					);
					const items = category.items?.docs ?? [];
					assertZodInternal(
						"tryGetGradebookJsonRepresentation: Items are required",
						items,
						z.array(z.number()),
					);

					const result = {
						...category,
						gradebook: gradebookId,
						parent,
						subcategories: subcategories,
						items: items,
					};
					return result;
				});
			});

		// Get all items for this gradebook (depth 0 to avoid deep nesting)
		const itemsPromise = payload
			.find({
				collection: "gradebook-items",
				where: {
					gradebook: {
						equals: gradebookId,
					},
				},
				joins: {
					// ! we don't need user grades
					userGrades: false,
				},
				depth: 0,
				pagination: false,
				sort: "sortOrder",
			})
			.then((i) => {
				const items = i.docs;
				return items.map((item) => {
					// type narrowing
					const category = item.category;
					assertZodInternal(
						"tryGetGradebookJsonRepresentation: Category is required",
						category,
						z.number().nullish(),
					);

					const activityModule = item.activityModule;
					assertZodInternal(
						"tryGetGradebookJsonRepresentation: Activity module is required",
						activityModule,
						z.number().nullish(),
					);

					const userGrades = item.userGrades;
					assertZodInternal(
						"tryGetGradebookJsonRepresentation: User grades are required",
						userGrades,
						z.undefined(),
					);

					const type = item.activityModuleType;
					//   type: 'page' | 'whiteboard' | 'assignment' | 'quiz' | 'discussion';

					assertZodInternal(
						"tryGetGradebookJsonRepresentation: Type is required",
						type,
						z
							.enum(["page", "whiteboard", "assignment", "quiz", "discussion"])
							.nullish(),
					);

					const activityModuleName = item.activityModuleName;
					assertZodInternal(
						"tryGetGradebookJsonRepresentation: Activity module name is required",
						activityModuleName,
						z.string().nullish(),
					);

					const result = {
						...item,
						category: category,
						gradebook: gradebookId,
						activityModule: activityModule,
						userGrades: userGrades,
						activityModuleType: type?.[0] ?? null,
						activityModuleName: activityModuleName?.[0] ?? null,
					};
					return result;
				});
			});

		// Wait for both queries to complete
		const [categoriesData, itemsData] = await Promise.all([
			categoriesPromise,
			itemsPromise,
		]);

		// Map categories to CategoryData type
		const categories: CategoryData[] = categoriesData.map((category) => ({
			id: category.id,
			gradebook: category.gradebook,
			parent: category.parent ?? null,
			name: category.name,
			weight: category.weight ?? null,
			subcategories: category.subcategories,
			items: category.items,
		}));

		// Map items to ItemData type
		const items: ItemData[] = itemsData.map((item) => ({
			id: item.id,
			gradebook: item.gradebook,
			category: item.category ?? null,
			name: item.name,
			activityModuleType: item.activityModuleType,
			activityModuleName: item.activityModuleName,
			weight: item.weight,
			maxGrade: item.maxGrade,
		}));

		// Build the structure recursively
		const setupItems: GradebookSetupItem[] = [];

		// Process root-level items (items without a category)
		const rootItems = items.filter((item) => !item.category);
		for (const item of rootItems) {
			setupItems.push({
				id: item.id,
				type: "manual_item",
				name: item.name,
				weight: item.weight || null,
				max_grade: item.maxGrade || null,
			});
		}

		// Process root categories (categories without a parent) recursively
		// Note: buildCategoryStructure(null) only processes categories, not items,
		// because root items are handled separately above
		const rootCategoryStructures = buildCategoryStructure(
			null,
			categories,
			items,
		);
		setupItems.push(...rootCategoryStructures);

		// Note: We don't calculate adjusted weights here since this is the raw JSON representation
		// Adjusted weights are calculated in tryGetGradebookSetupForUI

		const result: GradebookJsonRepresentation = {
			gradebook_id: gradebookId,
			course_id: courseId,
			gradebook_setup: {
				items: setupItems,
				exclude_empty_grades: true, // You can make this configurable if needed
			},
		};

		return result;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get gradebook JSON representation", {
			cause: error,
		}),
);

/**
 * Gets gradebook setup with calculations for UI display
 * This includes adjusted weights and overall weights, which are not in JSON/YAML
 */
export const tryGetGradebookSetupForUI = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
		// Get raw JSON representation (without calculations)
		const jsonResult = await tryGetGradebookJsonRepresentation(payload, gradebookId);

		if (!jsonResult.ok) {
			throw jsonResult.error;
		}

		const jsonData = jsonResult.value;

		// Calculate adjusted weights
		const itemsWithAdjusted = calculateAdjustedWeights(jsonData.gradebook_setup.items);

		// Calculate overall weights
		calculateOverallWeights(itemsWithAdjusted as GradebookSetupItemWithCalculations[]);

		return {
			gradebook_id: jsonData.gradebook_id,
			course_id: jsonData.course_id,
			gradebook_setup: {
				items: itemsWithAdjusted as GradebookSetupItemWithCalculations[],
				exclude_empty_grades: jsonData.gradebook_setup.exclude_empty_grades,
			},
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get gradebook setup for UI", {
			cause: error,
		}),
);

/**
 * Constructs a YAML representation of the gradebook structure
 * Built on top of the JSON representation
 */
export const tryGetGradebookYAMLRepresentation = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
		// Get JSON representation first
		const jsonResult = await tryGetGradebookJsonRepresentation(
			payload,
			gradebookId,
		);

		if (!jsonResult.ok) {
			throw jsonResult.error;
		}

		const jsonRepresentation = jsonResult.value;

		// Convert JSON to YAML using Bun.YAML.stringify
		let yamlString: string;
		try {
			yamlString = Bun.YAML?.stringify(jsonRepresentation, null, 2);
			if (!yamlString) {
				throw new Error("Bun.YAML is not available");
			}
		} catch (error) {
			throw new Error(
				`Failed to convert JSON to YAML: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		return yamlString;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get gradebook YAML representation", {
			cause: error,
		}),
);
