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
import type { CategoryData, ItemData } from "./utils/build-gradebook-structure";
import { buildCategoryStructure } from "./utils/build-gradebook-structure";
import {
	calculateAdjustedWeights,
	calculateOverallWeights,
} from "./utils/gradebook-weight-calculations";
import { prettifyMarkdown } from "./utils/markdown-prettify";

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
	extra_credit?: boolean; // Extra credit items don't affect weight distribution
	grade_items?: GradebookSetupItem[];
	activityModuleLinkId?: number | null; // Link ID to course-activity-module-links if this item is linked to an activity module
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
	totals: {
		baseTotal: number;
		extraCreditTotal: number;
		calculatedTotal: number;
		totalMaxGrade: number;
	};
	extraCreditItems: GradebookSetupItemWithCalculations[];
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
						activityModuleType: type ?? null,
						activityModuleName: activityModuleName ?? null,
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
			activityModuleLinkId: item.activityModule ?? null,
			weight: item.weight,
			maxGrade: item.maxGrade,
			extraCredit: item.extraCredit ?? false,
		}));

		// console.log("items", items);

		// Build the structure recursively
		const setupItems: GradebookSetupItem[] = [];

		// Process root-level items (items without a category)
		const rootItems = items.filter((item) => !item.category);
		for (const item of rootItems) {
			setupItems.push({
				id: item.id,
				type: (item.activityModuleType ?? "manual_item") as
					| "manual_item"
					| "category"
					| "page"
					| "whiteboard"
					| "assignment"
					| "quiz"
					| "discussion",
				name: item.activityModuleName ?? item.name,
				weight: item.weight || null,
				max_grade: item.maxGrade || null,
				extra_credit: item.extraCredit ?? false,
				activityModuleLinkId: item.activityModuleLinkId ?? null,
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
		const jsonResult = await tryGetGradebookJsonRepresentation(
			payload,
			gradebookId,
		);

		if (!jsonResult.ok) {
			throw jsonResult.error;
		}

		const jsonData = jsonResult.value;

		// Calculate adjusted weights
		const itemsWithAdjusted = calculateAdjustedWeights(
			jsonData.gradebook_setup.items,
		);

		// Calculate overall weights and get totals
		const totals = calculateOverallWeights(
			itemsWithAdjusted as GradebookSetupItemWithCalculations[],
		);

		return {
			gradebook_id: jsonData.gradebook_id,
			course_id: jsonData.course_id,
			gradebook_setup: {
				items: itemsWithAdjusted as GradebookSetupItemWithCalculations[],
				exclude_empty_grades: jsonData.gradebook_setup.exclude_empty_grades,
			},
			totals: {
				baseTotal: totals.baseTotal,
				extraCreditTotal: totals.extraCreditTotal,
				calculatedTotal: totals.calculatedTotal,
				totalMaxGrade: totals.totalMaxGrade,
			},
			extraCreditItems: totals.extraCreditItems,
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

/**
 * Formats a number or null as a percentage string
 */
function formatPercentage(value: number | null): string {
	if (value === null) {
		return "-";
	}
	return `${value.toFixed(2)}%`;
}

/**
 * Formats a number or null as a decimal string
 */
function formatNumber(value: number | null): string {
	if (value === null) {
		return "-";
	}
	return value.toFixed(2);
}

/**
 * Gets the type display name for an item
 */
function getTypeDisplayName(type: string): string {
	switch (type) {
		case "manual_item":
			return "Manual";
		case "page":
			return "Page";
		case "whiteboard":
			return "Whiteboard";
		case "assignment":
			return "Assignment";
		case "quiz":
			return "Quiz";
		case "discussion":
			return "Discussion";
		case "category":
			return "Category";
		default:
			return type;
	}
}

/**
 * Recursively calculates the sum of max grades for all leaf items in a category
 */
function calculateCategoryMaxGrade(
	items: GradebookSetupItemWithCalculations[],
): number {
	let sum = 0;
	for (const item of items) {
		if (item.type === "category" && item.grade_items) {
			sum += calculateCategoryMaxGrade(item.grade_items);
		} else {
			sum += item.max_grade ?? 0;
		}
	}
	return sum;
}

/**
 * Recursively builds hierarchical rows for the Grade Summary table
 */
function buildGradeSummaryRows(
	items: GradebookSetupItemWithCalculations[],
	depth: number = 0,
	prefix: string = "",
): string[] {
	const rows: string[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const isLast = i === items.length - 1;
		const isCategory = item.type === "category";
		const hasNestedItems =
			isCategory && item.grade_items && item.grade_items.length > 0;

		// Build the indentation prefix
		let itemPrefix = "";
		if (depth > 0) {
			itemPrefix = prefix + (isLast ? "└─ " : "├─ ");
		}

		// Build item name with extra credit indicator
		let itemName = item.name;
		if (isCategory) {
			itemName = `**${itemName}**`;
		}
		if (item.extra_credit) {
			itemName += ` (EC)`;
		}

		// Format weight
		const weightStr =
			item.adjusted_weight !== null
				? formatPercentage(item.adjusted_weight)
				: "-";

		// Format max grade
		let maxGradeStr: string;
		if (isCategory && hasNestedItems) {
			// For categories, calculate sum of children's max grades
			const categoryMaxGrade = calculateCategoryMaxGrade(
				item.grade_items ?? [],
			);
			maxGradeStr = categoryMaxGrade > 0 ? formatNumber(categoryMaxGrade) : "-";
		} else {
			maxGradeStr = formatNumber(item.max_grade);
		}

		// For now, show placeholder values for grades (can be enhanced later with actual user grades)
		const obtainedStr = "-"; // Placeholder
		const rawPercentStr = "-"; // Placeholder
		const weightedPercentStr =
			item.overall_weight !== null
				? formatPercentage(item.overall_weight)
				: "-";
		const contributionStr =
			item.overall_weight !== null
				? formatPercentage(item.overall_weight)
				: "-";

		rows.push(
			`| ${itemPrefix}${itemName} | ${weightStr} | ${maxGradeStr} | ${obtainedStr} | ${rawPercentStr} | ${weightedPercentStr} | ${contributionStr} |`,
		);

		// Recursively process nested items
		if (hasNestedItems && item.grade_items) {
			const newPrefix = prefix + (isLast ? "   " : "│  ");
			rows.push(
				...buildGradeSummaryRows(item.grade_items, depth + 1, newPrefix),
			);
		}
	}

	return rows;
}

/**
 * Recursively builds flat rows for the Full Grade Breakdown table
 */
function buildFullBreakdownRows(
	items: GradebookSetupItemWithCalculations[],
	depth: number = 0,
): string[] {
	const rows: string[] = [];

	for (const item of items) {
		const isCategory = item.type === "category";
		const indent = "  ".repeat(depth);

		// Build item name
		let itemName = item.name;
		if (isCategory) {
			itemName = `**${itemName}**`;
		} else if (item.extra_credit) {
			itemName = `**${itemName}**`;
		}

		// Format type
		let typeStr = getTypeDisplayName(item.type);
		if (item.extra_credit) {
			typeStr += " (EC)";
		}

		// Format weight (bold for extra credit items)
		const weightStr =
			item.adjusted_weight !== null
				? item.extra_credit
					? `**${formatPercentage(item.adjusted_weight)}**`
					: formatPercentage(item.adjusted_weight)
				: "-";

		// Format max grade
		let maxGradeStr: string;
		if (isCategory && item.grade_items) {
			const categoryMaxGrade = calculateCategoryMaxGrade(item.grade_items);
			maxGradeStr =
				categoryMaxGrade > 0 ? `**${formatNumber(categoryMaxGrade)}**` : "-";
		} else {
			maxGradeStr = formatNumber(item.max_grade);
		}

		// Placeholder values for grades
		const gradeStr =
			isCategory && item.grade_items
				? `**${formatNumber(0)}**` // Category total placeholder
				: "-";
		const percentStr =
			isCategory && item.grade_items
				? `**${formatPercentage(0)}**` // Category percent placeholder
				: item.extra_credit
					? "**-**"
					: "-";
		const weightedGradeStr =
			isCategory && item.grade_items
				? `**${formatNumber(0)}**` // Category weighted placeholder
				: item.extra_credit
					? "**-**"
					: "-";

		rows.push(
			`| ${item.id} | ${indent}${itemName} | ${typeStr} | ${weightStr} | ${maxGradeStr} | ${gradeStr} | ${percentStr} | ${weightedGradeStr} |`,
		);

		// Recursively process nested items
		if (isCategory && item.grade_items) {
			rows.push(...buildFullBreakdownRows(item.grade_items, depth + 1));
		}
	}

	return rows;
}

/**
 * Constructs a Markdown representation of the gradebook structure
 * Built on top of the JSON representation and UI setup
 */
export const tryGetGradebookMarkdownRepresentation = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
		// Get gradebook setup for UI (includes calculations)
		const setupResult = await tryGetGradebookSetupForUI(payload, gradebookId);

		if (!setupResult.ok) {
			throw setupResult.error;
		}

		const setup = setupResult.value;

		// Get course information
		const course = await payload.findByID({
			collection: "courses",
			id: setup.course_id,
			depth: 0,
		});

		if (!course) {
			throw new Error(`Course with ID ${setup.course_id} not found`);
		}

		// Build header
		const header = `# Grade Report

**Course:** Course ID ${setup.course_id}

**Gradebook ID:** ${setup.gradebook_id}

## Grade Summary

| Category/Path              | Weight | Max Grade | Obtained | Raw %  | Weighted % | Contribution |
|----------------------------|--------|-----------|----------|--------|------------|--------------|`;

		// Build grade summary rows
		const summaryRows = buildGradeSummaryRows(setup.gradebook_setup.items);
		const summarySection = [header, ...summaryRows].join("\n");

		// Build full breakdown header
		const breakdownHeader = `
## Full Grade Breakdown

| ID | Item Name              | Type         | Weight | Max Grade | Grade | %     | Weighted Grade |
|----|------------------------|--------------|--------|-----------|-------|-------|----------------|`;

		// Build full breakdown rows
		const breakdownRows = buildFullBreakdownRows(setup.gradebook_setup.items);
		const breakdownSection = [breakdownHeader, ...breakdownRows].join("\n");

		// Build totals section
		const totalsSection = `
**Current Course Total: ${formatNumber(0)} / ${formatNumber(setup.totals.totalMaxGrade)} (${formatPercentage(0)})**

**Gradebook Settings:**

| Setting                  | Value          |
|--------------------------|----------------|
| Exclude empty grades     | ${setup.gradebook_setup.exclude_empty_grades ? "Yes" : "No"}            |
| Show weight              | Yes            |
| Show contribution        | Yes            |
| Show range               | Yes            |

**(EC) = Extra Credit**`;

		// Combine all sections
		const rawMarkdown = [summarySection, breakdownSection, totalsSection].join(
			"\n",
		);

		// Prettify the markdown using remark
		const markdown = prettifyMarkdown(rawMarkdown);

		return markdown;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get gradebook markdown representation", {
			cause: error,
		}),
);
