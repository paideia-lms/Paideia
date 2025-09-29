import type { Payload } from "payload";
import { Result } from "typescript-result";
import { type Course, User } from "../payload-types";

export interface CreateCourseArgs {
	title: string;
	description: string;
	instructor: number; // User ID
	difficulty?: "beginner" | "intermediate" | "advanced";
	duration?: number;
	status?: "draft" | "published" | "archived";
	thumbnail?: string;
	tags?: { tag?: string }[];
}

export interface UpdateCourseArgs {
	title?: string;
	description?: string;
	instructor?: number; // User ID
	difficulty?: "beginner" | "intermediate" | "advanced";
	duration?: number;
	status?: "draft" | "published" | "archived";
	thumbnail?: string;
	tags?: { tag?: string }[];
}

export interface SearchCoursesArgs {
	title?: string;
	instructor?: number;
	difficulty?: "beginner" | "intermediate" | "advanced";
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
			instructor,
			difficulty = "beginner",
			duration,
			status = "draft",
			thumbnail,
			tags,
		} = args;

		// Verify instructor exists
		const instructorUser = await payload.findByID({
			collection: "users",
			id: instructor,
			req: request,
		});

		if (!instructorUser) {
			throw new Error(`Instructor with ID ${instructor} not found`);
		}

		const newCourse = await payload.create({
			collection: "courses",
			data: {
				title,
				description,
				instructor,
				difficulty,
				duration,
				status,
				thumbnail,
				tags,
			},
			req: request,
		});

		return newCourse as Course;
	},
	(error) =>
		new Error(
			`Failed to create course: ${error instanceof Error ? error.message : String(error)}`,
		),
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

		// If instructor is being updated, verify new instructor exists
		if (args.instructor) {
			const instructorUser = await payload.findByID({
				collection: "users",
				id: args.instructor,
				req: request,
			});

			if (!instructorUser) {
				throw new Error(`Instructor with ID ${args.instructor} not found`);
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
			collection: "courses",
			id: courseId,
		});

		if (!course) {
			throw new Error(`Course with ID ${courseId} not found`);
		}

		return course as Course;
	},
	(error) =>
		new Error(
			`Failed to find course by ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Searches courses with various filters
 */
export const trySearchCourses = Result.wrap(
	async (payload: Payload, args: SearchCoursesArgs = {}) => {
		const {
			title,
			instructor,
			difficulty,
			status,
			limit = 10,
			page = 1,
		} = args;

		const where: any = {};

		if (title) {
			where.title = {
				contains: title,
			};
		}

		if (instructor) {
			where.instructor = {
				equals: instructor,
			};
		}

		if (difficulty) {
			where.difficulty = {
				equals: difficulty,
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
		const deletedCourse = await payload.delete({
			collection: "courses",
			id: courseId,
			req: request,
		});

		return deletedCourse as Course;
	},
	(error) =>
		new Error(
			`Failed to delete course: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds courses by instructor ID
 */
export const tryFindCoursesByInstructor = Result.wrap(
	async (payload: Payload, instructorId: number, limit: number = 10) => {
		const courses = await payload.find({
			collection: "courses",
			where: {
				instructor: {
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
