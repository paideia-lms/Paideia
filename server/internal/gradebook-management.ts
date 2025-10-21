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

export interface GradebookSetup {
	items: GradebookSetupItem[];
	exclude_empty_grades: boolean;
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
		assertZodInternal("tryGetGradebookJsonRepresentation: Course is required",
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
					assertZodInternal("tryGetGradebookJsonRepresentation: Parent is required",
						parent,
						z.number().nullish(),
					);
					const subcategories = category.subcategories?.docs ?? [];
					assertZodInternal("tryGetGradebookJsonRepresentation: Subcategories are required",
						subcategories,
						z.array(z.number()),
					);
					const items = category.items?.docs ?? [];
					assertZodInternal("tryGetGradebookJsonRepresentation: Items are required",
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
					assertZodInternal("tryGetGradebookJsonRepresentation: Category is required",
						category,
						z.number().nullish(),
					);

					const activityModule = item.activityModule;
					assertZodInternal("tryGetGradebookJsonRepresentation: Activity module is required",
						activityModule,
						z.number().nullish(),
					);

					const userGrades = item.userGrades;
					assertZodInternal("tryGetGradebookJsonRepresentation: User grades are required",
						userGrades,
						z.undefined(),
					);

					const type = item.activityModuleType;
					//   type: 'page' | 'whiteboard' | 'assignment' | 'quiz' | 'discussion';

					assertZodInternal("tryGetGradebookJsonRepresentation: Type is required",
						type,
						z.enum(["page", "whiteboard", "assignment", "quiz", "discussion"]).array().nullish(),
					);

					const activityModuleName = item.activityModuleName;
					assertZodInternal("tryGetGradebookJsonRepresentation: Activity module name is required",
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
		const [categories, items] = await Promise.all([
			categoriesPromise,
			itemsPromise,
		]);

		// Build the structure
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

		// Process categories
		const rootCategories = categories.filter((category) => !category.parent);
		for (const category of rootCategories) {
			const categoryItems = items.filter(
				(item) => item.category === category.id,
			);

			const gradeItems: GradebookSetupItem[] = categoryItems.map((item) => ({
				id: item.id,
				type: item.activityModuleType ?? "manual_item",
				name: item.activityModuleName ?? item.name,
				weight: item.weight || null,
				max_grade: item.maxGrade || null,
			}));

			setupItems.push({
				id: category.id,
				type: "category",
				name: category.name,
				weight: category.weight || null,
				max_grade: null, // Categories don't have max_grade
				grade_items: gradeItems,
			});
		}

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
