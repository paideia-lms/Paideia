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

/**
 * Gets commit history starting from a specific commit
 */
export const tryGetCommitHistory = Result.wrap(
	async (
		payload: Payload,
		startCommitId: number,
		limit = 50,
		transactionID?: string | number,
	): Promise<Commit[]> => {
		const history: Commit[] = [];
		let currentCommitId: number | null = startCommitId;

		while (currentCommitId && history.length < limit) {
			const commit: Commit | null = await payload.findByID({
				collection: "commits",
				id: currentCommitId,
				depth: 0,
				...(transactionID && { req: { transactionID } }),
			});

			if (!commit) {
				break;
			}

			history.push(commit);

			// Get parent commit
			if (commit.parentCommit && typeof commit.parentCommit === "number") {
				currentCommitId = commit.parentCommit;
			} else {
				currentCommitId = null;
			}
		}

		return history;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get commit history", {
			cause: error,
		}),
);
