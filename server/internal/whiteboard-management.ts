import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	NonExistingWhiteboardError,
	transformError,
	UnknownError,
} from "~/utils/error";
import {
	interceptPayloadError,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";

export interface CreateWhiteboardArgs extends BaseInternalFunctionArgs {
	content?: string;
	userId: number;
}

export interface UpdateWhiteboardArgs extends BaseInternalFunctionArgs {
	id: number;
	content?: string;
}

export interface DeleteWhiteboardArgs extends BaseInternalFunctionArgs {
	id: number;
}

export interface GetWhiteboardByIdArgs extends BaseInternalFunctionArgs {
	id: number;
}

export function tryCreateWhiteboard(args: CreateWhiteboardArgs) {
	return Result.try(
		async () => {
			const { payload, content, userId, req, overrideAccess = false } = args;

			if (!userId) {
				throw new InvalidArgumentError("User ID is required");
			}

			const whiteboard = await payload
				.create({
					collection: "whiteboards",
					data: {
						content: content || "",
						createdBy: userId,
					},
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryCreateWhiteboard",
						args,
					});
					throw error;
				});

			return whiteboard;
		},
		(error) =>
			transformError(error) ?? new UnknownError("Failed to create whiteboard"),
	);
}

export function tryUpdateWhiteboard(args: UpdateWhiteboardArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				id,
				content,

				req,
				overrideAccess = false,
			} = args;

			if (!id) {
				throw new InvalidArgumentError("Whiteboard ID is required");
			}

			// Check if whiteboard exists
			const existingWhiteboard = await payload
				.findByID({
					collection: "whiteboards",
					id,
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "findByID">());

			if (!existingWhiteboard) {
				throw new NonExistingWhiteboardError("Whiteboard not found");
			}

			const whiteboard = await payload
				.update({
					collection: "whiteboards",
					id,
					data: {
						content,
					},
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			return whiteboard;
		},
		(error) =>
			transformError(error) ?? new UnknownError("Failed to update whiteboard"),
	);
}

export function tryDeleteWhiteboard(args: DeleteWhiteboardArgs) {
	return Result.try(
		async () => {
			const { payload, id, req, overrideAccess = false } = args;

			if (!id) {
				throw new InvalidArgumentError("Whiteboard ID is required");
			}

			// Check if whiteboard exists
			const existingWhiteboard = await payload
				.findByID({
					collection: "whiteboards",
					id,
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "findByID">());

			if (!existingWhiteboard) {
				throw new NonExistingWhiteboardError("Whiteboard not found");
			}

			const deletedWhiteboard = await payload
				.delete({
					collection: "whiteboards",
					id,
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "delete">());

			return { success: true, deletedWhiteboard };
		},
		(error) =>
			transformError(error) ?? new UnknownError("Failed to delete whiteboard"),
	);
}

export function tryGetWhiteboardById(args: GetWhiteboardByIdArgs) {
	return Result.try(
		async () => {
			const { payload, id, req, overrideAccess = false } = args;

			if (!id) {
				throw new InvalidArgumentError("Whiteboard ID is required");
			}

			const whiteboard = await payload
				.findByID({
					collection: "whiteboards",
					id,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryGetWhiteboardById",
						args,
					});
					throw error;
				});

			return whiteboard;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get whiteboard by ID"),
	);
}
