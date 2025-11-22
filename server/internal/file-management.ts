import type { Payload, PayloadRequest, TypedUser } from "payload";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	InvalidArgumentError,
	NonExistingFileError,
	transformError,
	UnknownError,
} from "~/utils/error";

export interface CreateFileArgs {
	payload: Payload;
	media?: number[];
	userId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateFileArgs {
	payload: Payload;
	id: number;
	media?: number[];
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeleteFileArgs {
	payload: Payload;
	id: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface GetFileByIdArgs {
	payload: Payload;
	id: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export const tryCreateFile = Result.wrap(
	async (args: CreateFileArgs) => {
		const {
			payload,
			media,
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const file = await payload
			.create({
				collection: "files",
				data: {
					media: media && media.length > 0 ? media : undefined,
					createdBy: userId,
				},
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZodInternal(
					"tryCreateFile: Created by is required",
					createdBy,
					z.object({ id: z.number() }),
				);
				return {
					...r,
					createdBy,
				};
			});

		return file;
	},
	(error) => transformError(error) ?? new UnknownError("Failed to create file"),
);

export const tryUpdateFile = Result.wrap(
	async (args: UpdateFileArgs) => {
		const {
			payload,
			id,
			media,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!id) {
			throw new InvalidArgumentError("File ID is required");
		}

		// Check if file exists
		const existingFile = await payload.findByID({
			collection: "files",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingFile) {
			throw new NonExistingFileError("File not found");
		}

		const file = await payload
			.update({
				collection: "files",
				id,
				data: {
					...(media !== undefined && {
						media: media && media.length > 0 ? media : [],
					}),
				},
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZodInternal(
					"tryUpdateFile: Created by is required",
					createdBy,
					z.object({ id: z.number() }),
				);
				return {
					...r,
					createdBy,
				};
			});

		return file;
	},
	(error) => transformError(error) ?? new UnknownError("Failed to update file"),
);

export const tryDeleteFile = Result.wrap(
	async (args: DeleteFileArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("File ID is required");
		}

		// Check if file exists
		const existingFile = await payload.findByID({
			collection: "files",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingFile) {
			throw new NonExistingFileError("File not found");
		}

		await payload.delete({
			collection: "files",
			id,
			user,
			req,
			overrideAccess,
		});

		return { success: true };
	},
	(error) => transformError(error) ?? new UnknownError("Failed to delete file"),
);

export const tryGetFileById = Result.wrap(
	async (args: GetFileByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("File ID is required");
		}

		const file = await payload.findByID({
			collection: "files",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!file) {
			throw new NonExistingFileError("File not found");
		}

		return file;
	},
	(error) =>
		transformError(error) ?? new UnknownError("Failed to get file by ID"),
);
