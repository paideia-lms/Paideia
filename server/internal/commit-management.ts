import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Commit, Tag } from "../payload-types";
import {
	generateCommitHash,
	generateContentHash,
} from "./activity-module-management";

export interface CreateCommitArgs {
	activityModule: number;
	message: string;
	author: number;
	content: Record<string, unknown>;
	/**
	 *  this must be provided
	 */
	parentCommit: number;
	commitDate?: Date;
}

/**
 * Creates a new commit with content hash and commit hash
 * Note: Activity module must exist before creating commits
 *
 * ! since parent commit is created during the activity module creation, we require it to be provided here
 *
 */
export const tryCreateCommit = Result.wrap(
	async (
		payload: Payload,
		args: CreateCommitArgs,
		transactionID?: string | number,
	): Promise<Commit> => {
		const {
			activityModule,
			message,
			author,
			content,
			parentCommit,
			commitDate = new Date(),
		} = args;

		// Validate required fields
		if (!activityModule) {
			throw new InvalidArgumentError("Activity module is required");
		}

		if (!message || message.trim() === "") {
			throw new InvalidArgumentError("Commit message is required");
		}

		if (!author) {
			throw new InvalidArgumentError("Author is required");
		}

		if (!content || typeof content !== "object" || Array.isArray(content)) {
			throw new InvalidArgumentError("Content must be a valid object");
		}

		// Verify activity module exists
		const activityModuleExists = await payload.findByID({
			collection: "activity-modules",
			id: activityModule,
			...(transactionID && { req: { transactionID } }),
		});

		if (!activityModuleExists) {
			throw new InvalidArgumentError(
				`Activity module with id '${activityModule}' not found`,
			);
		}

		// Generate content hash
		const contentHash = generateContentHash(content);

		// Get parent commit hash if parentCommit is provided
		let parentCommitHash: string | undefined;
		const parentCommitDoc = await payload.findByID({
			collection: "commits",
			id: parentCommit,
			...(transactionID && { req: { transactionID } }),
		});

		if (!parentCommitDoc) {
			throw new InvalidArgumentError(
				`Parent commit with id '${parentCommit}' not found`,
			);
		}

		parentCommitHash = parentCommitDoc.hash;

		// Generate commit hash
		const commitHash = generateCommitHash(
			content,
			message,
			author,
			commitDate,
			parentCommitHash,
		);

		// Create commit with activityModule as array
		const commit = await payload.create({
			collection: "commits",
			data: {
				activityModule: [activityModule],
				hash: commitHash,
				message,
				author,
				parentCommit: parentCommit || null,
				commitDate: commitDate.toISOString(),
				content,
				contentHash,
			},
			...(transactionID && { req: { transactionID } }),
		});

		return commit;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create commit", {
			cause: error,
		}),
);

/**
 * Gets a commit by hash
 */
export const tryGetCommitByHash = Result.wrap(
	async (
		payload: Payload,
		hash: string,
		transactionID?: string | number,
	): Promise<Commit> => {
		if (!hash || hash.trim() === "") {
			throw new InvalidArgumentError("Commit hash is required");
		}

		const commits = await payload.find({
			collection: "commits",
			where: {
				hash: { equals: hash },
			},
			// ! for now, we are getting every thing
			pagination: false,
			...(transactionID && { req: { transactionID } }),
		});

		if (commits.docs.length === 0) {
			throw new InvalidArgumentError(`Commit with hash '${hash}' not found`);
		}

		return commits.docs[0];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get commit by hash", {
			cause: error,
		}),
);

export interface GetCommitHistoryArgs {
	activityModuleId: number | string;
	limit?: number;
}

/**
 * Gets commit history for an activity module
 */
export const tryGetCommitHistory = Result.wrap(
	async (
		payload: Payload,
		args: GetCommitHistoryArgs,
		transactionID?: string | number,
	): Promise<Commit[]> => {
		const { activityModuleId, limit = 50 } = args;

		if (!activityModuleId) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		const result = await payload.find({
			collection: "commits",
			where: {
				activityModule: { equals: activityModuleId },
			},
			sort: "-commitDate",
			pagination: false,
			...(transactionID && { req: { transactionID } }),
		});

		return result.docs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get commit history", {
			cause: error,
		}),
);

export interface CreateTagArgs {
	name: string;
	description?: string;
	commitId: number;
	originId: number;
	userId: number;
	tagType?: "release" | "milestone" | "snapshot";
}

/**
 * Creates a tag for a commit within an origin
 */
export const tryCreateTag = Result.wrap(
	async (
		payload: Payload,
		args: CreateTagArgs,
		transactionID?: string | number,
	): Promise<Tag> => {
		const {
			name,
			description,
			commitId,
			originId,
			userId,
			tagType = "snapshot",
		} = args;

		// Validate required fields
		if (!name || name.trim() === "") {
			throw new InvalidArgumentError("Tag name is required");
		}

		if (!commitId) {
			throw new InvalidArgumentError("Commit ID is required");
		}

		if (!originId) {
			throw new InvalidArgumentError("Origin ID is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Verify commit exists
		const commit = await payload.findByID({
			collection: "commits",
			id: commitId,
			...(transactionID && { req: { transactionID } }),
		});

		if (!commit) {
			throw new InvalidArgumentError(`Commit with id '${commitId}' not found`);
		}

		// Verify origin exists
		const origin = await payload.findByID({
			collection: "origins",
			id: originId,
			...(transactionID && { req: { transactionID } }),
		});

		if (!origin) {
			throw new InvalidArgumentError(`Origin with id '${originId}' not found`);
		}

		// Verify user exists
		const user = await payload.findByID({
			collection: "users",
			id: userId,
			...(transactionID && { req: { transactionID } }),
		});

		if (!user) {
			throw new InvalidArgumentError(`User with id '${userId}' not found`);
		}

		// Create tag
		const tag = await payload.create({
			collection: "tags",
			data: {
				name,
				description: description || null,
				commit: commitId,
				origin: originId,
				tagType,
				createdBy: userId,
			},
			...(transactionID && { req: { transactionID } }),
		});

		return tag;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create tag", {
			cause: error,
		}),
);

/**
 * Gets a tag by name within an origin
 */
export const tryGetTagByName = Result.wrap(
	async (
		payload: Payload,
		name: string,
		originId: number,
		transactionID?: string | number,
	): Promise<Tag> => {
		if (!name || name.trim() === "") {
			throw new InvalidArgumentError("Tag name is required");
		}

		if (!originId) {
			throw new InvalidArgumentError("Origin ID is required");
		}

		const tags = await payload.find({
			collection: "tags",
			where: {
				and: [{ name: { equals: name } }, { origin: { equals: originId } }],
			},
			pagination: false,
			...(transactionID && { req: { transactionID } }),
		});

		if (tags.docs.length === 0) {
			throw new InvalidArgumentError(
				`Tag with name '${name}' not found in origin ${originId}`,
			);
		}

		return tags.docs[0];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get tag by name", {
			cause: error,
		}),
);

export interface GetTagsByCommitArgs {
	commitId: number;
}

/**
 * Gets all tags for a commit
 */
export const tryGetTagsByCommit = Result.wrap(
	async (
		payload: Payload,
		args: GetTagsByCommitArgs,
		transactionID?: string | number,
	): Promise<Tag[]> => {
		const { commitId } = args;

		if (!commitId) {
			throw new InvalidArgumentError("Commit ID is required");
		}

		const result = await payload.find({
			collection: "tags",
			where: {
				commit: { equals: commitId },
			},
			sort: "-createdAt",
			pagination: false,
			...(transactionID && { req: { transactionID } }),
		});

		return result.docs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get tags by commit", {
			cause: error,
		}),
);

export interface GetTagsByOriginArgs {
	originId: number;
}

/**
 * Gets all tags for an origin
 */
export const tryGetTagsByOrigin = Result.wrap(
	async (
		payload: Payload,
		args: GetTagsByOriginArgs,
		transactionID?: string | number,
	): Promise<Tag[]> => {
		const { originId } = args;

		if (!originId) {
			throw new InvalidArgumentError("Origin ID is required");
		}

		const result = await payload.find({
			collection: "tags",
			where: {
				origin: { equals: originId },
			},
			sort: "-createdAt",
			pagination: false,
			...(transactionID && { req: { transactionID } }),
		});

		return result.docs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get tags by origin", {
			cause: error,
		}),
);

/**
 * Deletes a tag by ID
 */
export const tryDeleteTag = Result.wrap(
	async (
		payload: Payload,
		tagId: number,
		transactionID?: string | number,
	): Promise<Tag> => {
		if (!tagId) {
			throw new InvalidArgumentError("Tag ID is required");
		}

		// Fetch the tag first to return it
		const tag = await payload.findByID({
			collection: "tags",
			id: tagId,
			...(transactionID && { req: { transactionID } }),
		});

		if (!tag) {
			throw new InvalidArgumentError(`Tag with id '${tagId}' not found`);
		}

		await payload.delete({
			collection: "tags",
			id: tagId,
			...(transactionID && { req: { transactionID } }),
		});

		return tag;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete tag", {
			cause: error,
		}),
);
