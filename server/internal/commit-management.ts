import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Commit } from "../payload-types";
import {
	generateCommitHash,
	generateContentHash,
} from "./activity-module-management";

export interface CreateCommitArgs {
	activityModule: number;
	message: string;
	author: number;
	content: Record<string, unknown>;
	parentCommit?: number | null;
	commitDate?: Date;
}

/**
 * Creates a new commit with content hash and commit hash
 * Note: Activity module must exist before creating commits
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
		if (parentCommit) {
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
		}

		// Generate commit hash
		const commitHash = generateCommitHash(
			content,
			message,
			author,
			commitDate,
			parentCommitHash,
		);

		// Create commit
		const commit = await payload.create({
			collection: "commits",
			data: {
				activityModule,
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
			limit: 1,
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
