import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	InvalidArgumentError,
	NonExistingFileError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type CreateFileArgs = BaseInternalFunctionArgs & {
	media?: number[];
	userId: number;
};

export type UpdateFileArgs = BaseInternalFunctionArgs & {
	id: number;
	media?: number[];
};

export type DeleteFileArgs = BaseInternalFunctionArgs & {
	id: number;
};

export type GetFileByIdArgs = BaseInternalFunctionArgs & {
	id: number;
};

export const tryCreateFile = Result.wrap(
	async (args: CreateFileArgs) => {
		const {
			payload,
			media,
			userId,

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
		const { payload, id, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("File ID is required");
		}

		// Check if file exists
		const existingFile = await payload.findByID({
			collection: "files",
			id,
			req,
			overrideAccess,
		});

		if (!existingFile) {
			throw new NonExistingFileError("File not found");
		}

		await payload.delete({
			collection: "files",
			id,
			req,
			overrideAccess,
		});

		return { success: true };
	},
	(error) => transformError(error) ?? new UnknownError("Failed to delete file"),
);

export const tryGetFileById = Result.wrap(
	async (args: GetFileByIdArgs) => {
		const { payload, id, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("File ID is required");
		}

		const file = await payload.findByID({
			collection: "files",
			id,
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
