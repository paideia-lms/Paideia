import type { Payload } from "payload";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";

export interface CreateActivityModuleArgs {
	title: string;
	description?: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	userId: number;
}

export interface UpdateActivityModuleArgs {
	id: number;
	title?: string;
	description?: string;
	type?: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
}

export interface GetActivityModuleByIdArgs {
	id: number | string;
}

/**
 * Creates a new activity module using Payload local API
 */
export const tryCreateActivityModule = Result.wrap(
	async (payload: Payload, args: CreateActivityModuleArgs) => {
		const { title, description, type, status = "draft", userId } = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!type) {
			throw new InvalidArgumentError("Type is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title,
				description,
				type,
				status,
				createdBy: userId,
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const createdBy = activityModule.createdBy;
		assertZod(
			createdBy,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...activityModule,
			createdBy,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create activity module", {
			cause: error,
		}),
);

/**
 * Get an activity module by ID
 */
export const tryGetActivityModuleById = Result.wrap(
	async (payload: Payload, args: GetActivityModuleByIdArgs) => {
		const { id } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Fetch the activity module
		const activityModuleResult = await payload.find({
			collection: "activity-modules",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
		});

		const activityModule = activityModuleResult.docs[0];

		if (!activityModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		const createdBy = activityModule.createdBy;
		assertZod(
			createdBy,
			z.object({
				id: z.number(),
			}),
		);

		// narrow the type
		return {
			...activityModule,
			createdBy,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get activity module", {
			cause: error,
		}),
);

/**
 * Updates an activity module
 */
export const tryUpdateActivityModule = Result.wrap(
	async (payload: Payload, args: UpdateActivityModuleArgs) => {
		const { id, title, description, type, status } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Build update data object
		const updateData: Record<string, unknown> = {};
		if (title !== undefined) updateData.title = title;
		if (description !== undefined) updateData.description = description;
		if (type !== undefined) updateData.type = type;
		if (status !== undefined) updateData.status = status;

		// Validate that at least one field is being updated
		if (Object.keys(updateData).length === 0) {
			throw new InvalidArgumentError(
				"At least one field must be provided for update",
			);
		}

		const updatedActivityModule = await payload.update({
			collection: "activity-modules",
			id,
			data: updateData,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const createdBy = updatedActivityModule.createdBy;
		assertZod(
			createdBy,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedActivityModule,
			createdBy,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update activity module", {
			cause: error,
		}),
);

/**
 * Deletes an activity module
 */
export const tryDeleteActivityModule = Result.wrap(
	async (payload: Payload, id: number) => {
		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Check if activity module exists
		const existingModule = await payload.findByID({
			collection: "activity-modules",
			id,
		});

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		const deletedActivityModule = await payload.delete({
			collection: "activity-modules",
			id,
		});

		return deletedActivityModule;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete activity module", {
			cause: error,
		}),
);

/**
 * Lists activity modules with optional filtering
 */
export const tryListActivityModules = Result.wrap(
	async (
		payload: Payload,
		args: {
			userId?: number;
			type?: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
			status?: "draft" | "published" | "archived";
			limit?: number;
			page?: number;
		} = {},
	) => {
		const { userId, type, status, limit = 10, page = 1 } = args;

		const where: Record<string, { equals: unknown }> = {};

		if (userId) {
			where.createdBy = {
				equals: userId,
			};
		}

		if (type) {
			where.type = {
				equals: type,
			};
		}

		if (status) {
			where.status = {
				equals: status,
			};
		}

		const result = await payload.find({
			collection: "activity-modules",
			where,
			limit,
			page,
			sort: "-createdAt",
		});

		return {
			docs: result.docs,
			totalDocs: result.totalDocs,
			totalPages: result.totalPages,
			page: result.page,
			limit: result.limit,
			hasNextPage: result.hasNextPage,
			hasPrevPage: result.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to list activity modules", {
			cause: error,
		}),
);
