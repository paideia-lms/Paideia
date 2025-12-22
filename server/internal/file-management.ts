import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	NonExistingFileError,
	transformError,
	UnknownError,
} from "~/utils/error";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";

export interface CreateFileArgs extends BaseInternalFunctionArgs {
	media?: number[];
	userId: number;
}

export interface UpdateFileArgs extends BaseInternalFunctionArgs {
	id: number;
	media?: number[];
}

export interface DeleteFileArgs extends BaseInternalFunctionArgs {
	id: number;
}

export interface GetFileByIdArgs extends BaseInternalFunctionArgs {
	id: number;
}

export function tryCreateFile(args: CreateFileArgs) {
	return Result.try(
		async () => {
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
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">());

			return file;
		},
		(error) =>
			transformError(error) ?? new UnknownError("Failed to create file"),
	);
}

export function tryUpdateFile(args: UpdateFileArgs) {
	return Result.try(
		async () => {
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
			// const existingFile = await payload.findByID({
			// 	collection: "files",
			// 	id,
			// 	req,
			// 	overrideAccess,
			// });

			// if (!existingFile) {
			// 	throw new NonExistingFileError("File not found");
			// }

			const file = await payload
				.update({
					collection: "files",
					id,
					data: {
						...(media !== undefined && {
							media: media && media.length > 0 ? media : [],
						}),
					},
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			return file;
		},
		(error) =>
			transformError(error) ?? new UnknownError("Failed to update file"),
	);
}

export function tryDeleteFile(args: DeleteFileArgs) {
	return Result.try(
		async () => {
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
		(error) =>
			transformError(error) ?? new UnknownError("Failed to delete file"),
	);
}

export function tryGetFileById(args: GetFileByIdArgs) {
	return Result.try(
		async () => {
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
}
