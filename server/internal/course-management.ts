import type { Payload } from "payload";
import { Courses, Gradebooks } from "server/payload.config";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Course } from "../payload-types";

export interface CreateCourseArgs {
	title: string;
	description: string;
	slug: string;
	structure?: Course["structure"];
	createdBy: number;
	status?: "draft" | "published" | "archived";
	thumbnail?: number;
	tags?: { tag?: string }[];
}

export interface UpdateCourseArgs {
	title?: string;
	description?: string;
	createdBy?: number; // User ID
	status?: "draft" | "published" | "archived";
	thumbnail?: number;
	tags?: { tag?: string }[];
}

export interface SearchCoursesArgs {
	title?: string;
	createdBy?: number;
	status?: "draft" | "published" | "archived";
	limit?: number;
	page?: number;
}

/**
 * Creates a new course using Payload local API
 */
export const tryCreateCourse = Result.wrap(
	async (payload: Payload, request: Request, args: CreateCourseArgs) => {
		const {
			title,
			description,
			slug,
			structure,
			createdBy,
			status = "draft",
			thumbnail,
			tags,
		} = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const newCourse = await payload.create({
				collection: Courses.slug,
				data: {
					title,
					description,
					structure:
						structure ??
						({
							sections: [
								{
									title: "Introduction",
									description: "Introduction to the course",
									lessons: [
										{
											title: "Introduction to the course",
											description: "Introduction to the course",
										},
									],
								},
							],
						} as Course["structure"]),
					slug,
					createdBy,
					status,
					thumbnail,
					tags,
				},
				req: { ...request, transactionID },
			});

			// create the gradebook as well
			const gradebookResult = await payload.create({
				collection: Gradebooks.slug,
				data: {
					course: newCourse.id,
				},
				depth: 0,
				req: { ...request, transactionID },
			});

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const createdByUser = newCourse.createdBy;
			assertZod(
				createdByUser,
				z.object({
					id: z.number(),
				}),
			);

			const newCourseThumbnail = newCourse.thumbnail;
			assertZod(
				newCourseThumbnail,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			// commit the transaction
			await payload.db.commitTransaction(transactionID);

			const result = {
				...newCourse,
				createdBy: createdByUser,
				gradebook: gradebookResult,
				thumbnail: newCourseThumbnail,
			};
			return result;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create course", {
			cause: error,
		}),
);

/**
 * Updates an existing course using Payload local API
 */
export const tryUpdateCourse = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		courseId: number,
		args: UpdateCourseArgs,
	) => {
		// Check if course exists
		const existingCourse = await payload.findByID({
			collection: "courses",
			id: courseId,
			req: request,
		});

		if (!existingCourse) {
			throw new Error(`Course with ID ${courseId} not found`);
		}

		// If createdBy is being updated, verify new user exists
		if (args.createdBy) {
			const user = await payload.findByID({
				collection: "users",
				id: args.createdBy,
				req: request,
			});

			if (!user) {
				throw new Error(`User with ID ${args.createdBy} not found`);
			}
		}

		const updatedCourse = await payload.update({
			collection: "courses",
			id: courseId,
			data: args,
			req: request,
		});

		return updatedCourse as Course;
	},
	(error) =>
		new Error(
			`Failed to update course: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a course by ID
 */
export const tryFindCourseById = Result.wrap(
	async (payload: Payload, courseId: number) => {
		const course = await payload.findByID({
			collection: Courses.slug,
			id: courseId,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const courseCreatedBy = course.createdBy;
		assertZod(
			courseCreatedBy,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...course,
			createdBy: courseCreatedBy,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find course by ID", {
			cause: error,
		}),
);

/**
 * Searches courses with various filters
 */
export const trySearchCourses = Result.wrap(
	async (payload: Payload, args: SearchCoursesArgs = {}) => {
		const { title, createdBy, status, limit = 10, page = 1 } = args;

		const where: any = {};

		if (title) {
			where.title = {
				contains: title,
			};
		}

		if (createdBy) {
			where.createdBy = {
				equals: createdBy,
			};
		}

		if (status) {
			where.status = {
				equals: status,
			};
		}

		const courses = await payload.find({
			collection: "courses",
			where,
			limit,
			page,
			sort: "-createdAt",
		});

		return {
			docs: courses.docs as Course[],
			totalDocs: courses.totalDocs,
			totalPages: courses.totalPages,
			page: courses.page,
			limit: courses.limit,
			hasNextPage: courses.hasNextPage,
			hasPrevPage: courses.hasPrevPage,
		};
	},
	(error) =>
		new Error(
			`Failed to search courses: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes a course by ID
 */
export const tryDeleteCourse = Result.wrap(
	async (payload: Payload, request: Request, courseId: number) => {
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}
		try {
			// first we need to delete the gradebook
			await payload.delete({
				collection: Gradebooks.slug,
				where: {
					course: { equals: courseId },
				},
				req: { ...request, transactionID },
			});

			const deletedCourse = await payload.delete({
				collection: Courses.slug,
				id: courseId,
				req: { ...request, transactionID },
			});

			// commit the transaction
			await payload.db.commitTransaction(transactionID);

			return deletedCourse;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete course", {
			cause: error,
		}),
);

/**
 * Finds courses by instructor ID
 */
export const tryFindCoursesByInstructor = Result.wrap(
	async (payload: Payload, instructorId: number, limit: number = 10) => {
		const courses = await payload.find({
			collection: "courses",
			where: {
				createdBy: {
					equals: instructorId,
				},
			},
			limit,
			sort: "-createdAt",
		});

		return courses.docs as Course[];
	},
	(error) =>
		new Error(
			`Failed to find courses by instructor: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds published courses only
 */
export const tryFindPublishedCourses = Result.wrap(
	async (payload: Payload, limit: number = 10, page: number = 1) => {
		const courses = await payload.find({
			collection: "courses",
			where: {
				status: {
					equals: "published",
				},
			},
			limit,
			page,
			sort: "-createdAt",
		});

		return {
			docs: courses.docs as Course[],
			totalDocs: courses.totalDocs,
			totalPages: courses.totalPages,
			page: courses.page,
			limit: courses.limit,
			hasNextPage: courses.hasNextPage,
			hasPrevPage: courses.hasPrevPage,
		};
	},
	(error) =>
		new Error(
			`Failed to find published courses: ${error instanceof Error ? error.message : String(error)}`,
		),
);
