import type { Payload } from "payload";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { ActivityModule, Commit, Tag } from "../payload-types";
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
	) => {
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

		// Generate content hash
		const contentHash = generateContentHash(content);

		// Get parent commit hash if parentCommit is provided

		const parentCommitDoc = await payload.findByID({
			collection: "commits",
			id: parentCommit,
			depth: 1,
			...(transactionID && { req: { transactionID } }),
		});

		if (!parentCommitDoc) {
			throw new InvalidArgumentError(
				`Parent commit with id '${parentCommit}' not found`,
			);
		}

		const parentCommitHash = parentCommitDoc.hash;

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
			depth: 1,
			...(transactionID && { req: { transactionID } }),
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const commitActivityModule = commit.activityModule;
		assertZod(
			commitActivityModule,
			z.array(
				z.object({
					id: z.number(),
				}),
			),
		);

		const commitAuthor = commit.author;
		assertZod(
			commitAuthor,
			z.object({
				id: z.number(),
			}),
		);

		const commitParentCommit = commit.parentCommit;
		assertZod(
			commitParentCommit,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...commit,
			activityModule: commitActivityModule as ActivityModule[],
			author: commitAuthor,
			parentCommit: commitParentCommit,
			parentCommitHash: parentCommitHash,
		};
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
		const { activityModuleId, limit } = args;

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
			limit,
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
			depth: 1,
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

export interface GetHeadCommitArgs {
	activityModuleId: number | string;
}

/**
 * Gets the head commit (latest commit) for an activity module
 */
export const tryGetHeadCommit = Result.wrap(
	async (
		payload: Payload,
		args: GetHeadCommitArgs,
		transactionID?: string | number,
	): Promise<Commit> => {
		const { activityModuleId } = args;

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
			limit: 1,
			...(transactionID && { req: { transactionID } }),
		});

		if (result.docs.length === 0) {
			throw new InvalidArgumentError(
				`No commits found for activity module '${activityModuleId}'`,
			);
		}

		return result.docs[0];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get head commit", {
			cause: error,
		}),
);

export interface GetTagsByOriginArgs {
	originId: number;
}

export interface MergeAnalysisArgs {
	fromActivityModuleId: number;
	toActivityModuleId: number;
}

export interface MergeAnalysisResult {
	strategy: "fast-forward" | "three-way";
	fromCommits: Commit[];
	toCommits: Commit[];
	commonAncestor?: Commit;
	divergedCommits: Commit[];
}

/**
 * Analyzes two activity modules to determine merge strategy
 * Returns whether it's a fast-forward merge or three-way merge
 */
export const tryAnalyzeMergeStrategy = Result.wrap(
	async (
		payload: Payload,
		args: MergeAnalysisArgs,
		transactionID?: string | number,
	): Promise<MergeAnalysisResult> => {
		const { fromActivityModuleId, toActivityModuleId } = args;

		if (!fromActivityModuleId) {
			throw new InvalidArgumentError("From activity module ID is required");
		}

		if (!toActivityModuleId) {
			throw new InvalidArgumentError("To activity module ID is required");
		}

		// Get commit history for both branches
		const fromHistoryResult = await tryGetCommitHistory(
			payload,
			{
				activityModuleId: fromActivityModuleId,
			},
			transactionID,
		);

		if (!fromHistoryResult.ok) {
			throw new InvalidArgumentError(
				"Failed to get from branch commit history",
			);
		}

		const toHistoryResult = await tryGetCommitHistory(
			payload,
			{
				activityModuleId: toActivityModuleId,
			},
			transactionID,
		);

		if (!toHistoryResult.ok) {
			throw new InvalidArgumentError("Failed to get to branch commit history");
		}

		const fromCommits = fromHistoryResult.value;
		const toCommits = toHistoryResult.value;

		// Find common ancestor by looking for commits that exist in both branches
		let commonAncestor: Commit | undefined;
		const fromCommitHashes = new Set(fromCommits.map((c) => c.hash));

		// Find the first commit in 'to' branch that also exists in 'from' branch
		for (const toCommit of toCommits) {
			if (fromCommitHashes.has(toCommit.hash)) {
				commonAncestor = toCommit;
				break;
			}
		}

		// If no common ancestor found, they are completely separate branches
		if (!commonAncestor) {
			throw new InvalidArgumentError(
				"No common ancestor found between branches",
			);
		}

		// Find commits that diverged after the common ancestor
		const divergedCommits: Commit[] = [];
		const commonAncestorIndex = toCommits.findIndex(
			(c) => c.hash === commonAncestor.hash,
		);

		// Get commits in 'to' branch that came after the common ancestor
		for (let i = 0; i < commonAncestorIndex; i++) {
			const commit = toCommits[i];
			if (!fromCommitHashes.has(commit.hash)) {
				divergedCommits.push(commit);
			}
		}

		// Determine strategy
		const strategy: "fast-forward" | "three-way" =
			divergedCommits.length === 0 ? "fast-forward" : "three-way";

		return {
			strategy,
			fromCommits,
			toCommits,
			commonAncestor,
			divergedCommits,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to analyze merge strategy", {
			cause: error,
		}),
);

export interface CreateMergeCommitArgs {
	toActivityModuleId: number;
	mergeReport: string;
	resolvedContent: Record<string, unknown>;
	authorId: number;
	commitDate?: Date;
}

/**
 * Creates a merge commit in the target branch
 */
export const tryCreateMergeCommit = Result.wrap(
	async (
		payload: Payload,
		args: CreateMergeCommitArgs,
		transactionID?: string | number,
	): Promise<Commit> => {
		const {
			toActivityModuleId,
			mergeReport,
			resolvedContent,
			authorId,
			commitDate = new Date(),
		} = args;

		// Get the head commit of the target branch (to branch)
		const headCommitResult = await tryGetHeadCommit(
			payload,
			{
				activityModuleId: toActivityModuleId,
			},
			transactionID,
		);

		if (!headCommitResult.ok) {
			throw new InvalidArgumentError(
				"Failed to get head commit of target branch",
			);
		}

		const headCommit = headCommitResult.value;

		// Create the merge commit
		const mergeCommitResult = await tryCreateCommit(
			payload,
			{
				activityModule: toActivityModuleId,
				message: mergeReport,
				author: authorId,
				content: resolvedContent,
				parentCommit: headCommit.id,
				commitDate,
			},
			transactionID,
		);

		if (!mergeCommitResult.ok) {
			throw new InvalidArgumentError("Failed to create merge commit");
		}

		return mergeCommitResult.value;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create merge commit", {
			cause: error,
		}),
);

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
