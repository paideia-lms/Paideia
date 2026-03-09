import { Payload } from "payload";
import packageJson from "../package.json";
import { Files } from "./collections/files";
import {
	CreateFileArgs,
	tryCreateFile,
	tryUpdateFile,
	UpdateFileArgs,
	FindFileByIdArgs,
	tryFindFileById,
	trySearchFiles,
	SearchFilesArgs,
	tryDeleteFile,
	DeleteFileArgs,
	tryFindFilesByUser,
	FindFilesByUserArgs,
} from "./services/file-management";
import {
	createFile,
	updateFile,
	findFileById,
	searchFiles,
	deleteFile,
	findFilesByUser,
} from "./api/file-management";

/**
 * File Module
 * 
 * @upstream
 * - `user`: Required for file ownership (createdBy field) and media attachments.
 * 
 * @downstream None. Files are standalone resource entities.
 * 
 * Provides file activity functionality similar to Moodle's file resource.
 * Allows instructors to upload and share multiple files with students in a course.
 */
export class FileModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(packageJson.dependencies);
	public static readonly collections = [Files];
	public static readonly cli = {};
	public static readonly search = [];
	public static readonly seedData = {};
	public static readonly queues = [];
	public static readonly tasks = [];
	public static readonly api = {
		createFile,
		updateFile,
		findFileById,
		searchFiles,
		deleteFile,
		findFilesByUser,
	};

	constructor(payload: Payload) {
		this.payload = payload;
	}

	createFile(args: Omit<CreateFileArgs, "payload">) {
		return tryCreateFile({
			payload: this.payload,
			...args,
		});
	}

	updateFile(args: Omit<UpdateFileArgs, "payload">) {
		return tryUpdateFile({
			payload: this.payload,
			...args,
		});
	}

	findFileById(args: Omit<FindFileByIdArgs, "payload">) {
		return tryFindFileById({
			payload: this.payload,
			...args,
		});
	}

	searchFiles(args: Omit<SearchFilesArgs, "payload">) {
		return trySearchFiles({
			payload: this.payload,
			...args,
		});
	}

	deleteFile(args: Omit<DeleteFileArgs, "payload">) {
		return tryDeleteFile({
			payload: this.payload,
			...args,
		});
	}

	findFilesByUser(args: Omit<FindFilesByUserArgs, "payload">) {
		return tryFindFilesByUser({
			payload: this.payload,
			...args,
		});
	}
}
