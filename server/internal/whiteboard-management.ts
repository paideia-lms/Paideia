import type { Payload, PayloadRequest } from "payload";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	InvalidArgumentError,
	NonExistingWhiteboardError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { User } from "../payload-types";

export interface CreateWhiteboardArgs {
	payload: Payload;
	content?: string;
	userId: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateWhiteboardArgs {
	payload: Payload;
	id: number;
	content?: string;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeleteWhiteboardArgs {
	payload: Payload;
	id: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface GetWhiteboardByIdArgs {
	payload: Payload;
	id: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export const tryCreateWhiteboard = Result.wrap(
	async (args: CreateWhiteboardArgs) => {
		const {
			payload,
			content,
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

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
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZodInternal(
					"tryCreateWhiteboard: Created by is required",
					createdBy,
					z.object({ id: z.number() }),
				);
				return {
					...r,
					createdBy,
				};
			});

		return whiteboard;
	},
	(error) =>
		transformError(error) ?? new UnknownError("Failed to create whiteboard"),
);

export const tryUpdateWhiteboard = Result.wrap(
	async (args: UpdateWhiteboardArgs) => {
		const {
			payload,
			id,
			content,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!id) {
			throw new InvalidArgumentError("Whiteboard ID is required");
		}

		// Check if whiteboard exists
		const existingWhiteboard = await payload.findByID({
			collection: "whiteboards",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingWhiteboard) {
			throw new NonExistingWhiteboardError("Whiteboard not found");
		}

		const whiteboard = await payload.update({
			collection: "whiteboards",
			id,
			data: {
				content,
			},
			user,
			req,
			overrideAccess,
		});

		return whiteboard;
	},
	(error) =>
		transformError(error) ?? new UnknownError("Failed to update whiteboard"),
);

export const tryDeleteWhiteboard = Result.wrap(
	async (args: DeleteWhiteboardArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("Whiteboard ID is required");
		}

		// Check if whiteboard exists
		const existingWhiteboard = await payload.findByID({
			collection: "whiteboards",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingWhiteboard) {
			throw new NonExistingWhiteboardError("Whiteboard not found");
		}

		await payload.delete({
			collection: "whiteboards",
			id,
			user,
			req,
			overrideAccess,
		});

		return { success: true };
	},
	(error) =>
		transformError(error) ?? new UnknownError("Failed to delete whiteboard"),
);

export const tryGetWhiteboardById = Result.wrap(
	async (args: GetWhiteboardByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("Whiteboard ID is required");
		}

		const whiteboard = await payload
			.findByID({
				collection: "whiteboards",
				id,
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZodInternal(
					"tryGetWhiteboardById: Created by is required",
					createdBy,
					z.object({ id: z.number() }),
				);
				return {
					...r,
					createdBy,
				};
			});

		if (!whiteboard) {
			throw new NonExistingWhiteboardError("Whiteboard not found");
		}

		return whiteboard;
	},
	(error) =>
		transformError(error) ?? new UnknownError("Failed to get whiteboard by ID"),
);
