import { createHash } from "node:crypto";
import { MerkleTree } from "merkletreejs";
import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	DuplicateBranchError,
	NonExistingSourceError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type {
	ActivityModule,
	ActivityModuleVersion,
	Branch,
	Commit,
} from "../payload-types";

export function SHA256(data: string): string {
	return createHash("sha256").update(data).digest("hex");
}
export interface CreateActivityModuleArgs {
	slug: string;
	title: string;
	description?: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	content: Record<string, unknown>; // JSON/YAML content
	commitMessage?: string;
	branchName?: string; // defaults to "main"
	userId: number;
}

export interface UpdateActivityModuleArgs {
	title?: string;
	description?: string;
	status?: "draft" | "published" | "archived";
	content?: Record<string, unknown>;
	commitMessage?: string;
	branchName?: string; // defaults to current branch or "main"
	userId: number;
}

export interface SearchActivityModulesArgs {
	title?: string;
	type?: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	createdBy?: number;
	branchName?: string; // defaults to "main"
	limit?: number;
	page?: number;
}

export interface GetActivityModuleArgs {
	slug?: string;
	id?: number;
	branchName?: string; // defaults to "main"
	commitHash?: string; // get specific version
}

export interface CreateBranchArgs {
	branchName: string;
	description?: string;
	fromBranch?: string; // defaults to "main"
	userId: number;
}

export interface MergeBranchArgs {
	sourceBranch: string;
	targetBranch: string;
	mergeMessage?: string;
	userId: number;
}

export interface GetBranchesForModuleArgs {
	moduleSlug?: string;
	moduleId?: number;
}

/**
 * Generate content hash using MerkleTree
 */
export const generateContentHash = (
	content: Record<string, unknown>,
): string => {
	const contentString = JSON.stringify(content, Object.keys(content).sort());
	const leaves = [contentString].map((x) => SHA256(x));
	const tree = new MerkleTree(leaves, SHA256);
	return tree.getRoot().toString("hex");
};

/**
 * Generate unique commit hash using MerkleTree
 */
export const generateCommitHash = (
	content: Record<string, unknown>,
	message: string,
	authorId: number,
	timestamp: Date,
): string => {
	const data = {
		content: JSON.stringify(content, Object.keys(content).sort()),
		message,
		authorId,
		timestamp: timestamp.toISOString(),
	};
	const dataString = JSON.stringify(data);
	const leaves = [dataString].map((x) => SHA256(x));
	const tree = new MerkleTree(leaves, SHA256);
	return tree.getRoot().toString("hex");
};

/**
 * Get or create the main branch
 */
const tryGetOrCreateMainBranch = Result.wrap(
	async (payload: Payload, userId: number, transactionID: string | number) => {
		// Try to find main branch
		const existingBranches = await payload.find({
			collection: "branches",
			where: {
				name: { equals: "main" },
			},
			req: { transactionID },
		});

		if (existingBranches.docs.length > 0) {
			return existingBranches.docs[0] as Branch;
		}

		// Create main branch
		const mainBranch = await payload.create({
			collection: "branches",
			data: {
				name: "main",
				description: "Main branch",
				isDefault: true,
				createdBy: userId,
			},
			req: { transactionID },
		});

		return mainBranch as Branch;
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to get or create main branch`, {
			cause: error,
		}),
);

/**
 * Get branch by name
 */
const tryGetBranchByName = Result.wrap(
	async (
		payload: Payload,
		branchName: string,
		transactionID?: string | number,
	) => {
		const branches = await payload.find({
			collection: "branches",
			where: {
				name: { equals: branchName },
			},
			req: transactionID ? { transactionID } : undefined,
		});

		if (branches.docs.length === 0) {
			throw new NonExistingSourceError(`Branch '${branchName}' not found`);
		}

		return branches.docs[0] as Branch;
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to get branch`, {
			cause: error,
		}),
);

/**
 * Creates a new branch from an existing branch
 */
export const tryCreateBranch = Result.wrap(
	async (payload: Payload, args: CreateBranchArgs) => {
		const { branchName, description, fromBranch = "main", userId } = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new Error("Transaction ID not found");
		}

		try {
			// Check if branch already exists
			const existingBranches = await payload.find({
				collection: "branches",
				where: {
					name: { equals: branchName },
				},
				req: { transactionID },
			});

			if (existingBranches.docs.length > 0) {
				throw new DuplicateBranchError(`Branch '${branchName}' already exists`);
			}

			// Get the source branch
			const sourceBranchResult = await tryGetBranchByName(
				payload,
				fromBranch,
				transactionID,
			);
			if (!sourceBranchResult.ok) {
				throw sourceBranchResult.error;
			}
			const sourceBranch = sourceBranchResult.value;

			// Create new branch
			const newBranch = await payload.create({
				collection: "branches",
				data: {
					name: branchName,
					description: description || `Branch created from ${fromBranch}`,
					isDefault: false,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Get all current head versions from the source branch
			const sourceVersions = await payload.find({
				collection: "activity-module-versions",
				where: {
					and: [
						{ branch: { equals: sourceBranch.id } },
						{ isCurrentHead: { equals: true } },
					],
				},
				req: { transactionID },
			});

			// Copy all current head versions to the new branch
			const copiedVersions = [];
			for (const sourceVersion of sourceVersions.docs) {
				const version = sourceVersion as ActivityModuleVersion;

				const newVersion = await payload.create({
					collection: "activity-module-versions",
					data: {
						activityModule: version.activityModule as number,
						commit: version.commit as number,
						branch: newBranch.id as number,
						content: version.content,
						title: version.title,
						description: version.description,
						isCurrentHead: true,
						contentHash: version.contentHash,
					},
					req: { transactionID },
				});

				copiedVersions.push(newVersion);
			}

			await payload.db.commitTransaction(transactionID);

			return {
				branch: newBranch as Branch,
				sourceBranch: sourceBranch,
				copiedVersionsCount: copiedVersions.length,
			};
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to create branch`, {
			cause: error,
		}),
);

/**
 * Creates a new activity module with initial version
 */
export const tryCreateActivityModule = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		args: CreateActivityModuleArgs,
	) => {
		const {
			slug,
			title,
			description,
			type,
			status = "draft",
			content,
			commitMessage = "Initial commit",
			branchName = "main",
			userId,
		} = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new Error("Transaction ID not found");
		}

		try {
			// Check if activity module with slug already exists
			const existingModules = await payload.find({
				collection: "activity-modules",
				where: {
					slug: { equals: slug },
				},
				req: { transactionID },
			});

			if (existingModules.docs.length > 0) {
				throw new Error(`Activity module with slug '${slug}' already exists`);
			}

			// Get or create branch
			const branchResult =
				branchName === "main"
					? await tryGetOrCreateMainBranch(payload, userId, transactionID)
					: await tryGetBranchByName(payload, branchName, transactionID);

			if (!branchResult.ok) {
				throw branchResult.error;
			}
			const branch = branchResult.value;

			// Create activity module
			const activityModule = await payload.create({
				collection: "activity-modules",
				data: {
					slug,
					title,
					description,
					type,
					status,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Generate hashes
			const contentHash = generateContentHash(content);
			const commitHash = generateCommitHash(
				content,
				commitMessage,
				userId,
				new Date(),
			);

			// Create commit
			const commit = await payload.create({
				collection: "commits",
				data: {
					hash: commitHash,
					message: commitMessage,
					author: userId,
					committer: userId,
					isMergeCommit: false,
					commitDate: new Date().toISOString(),
				},
				req: { transactionID },
			});

			// Create activity module version
			const version = await payload.create({
				collection: "activity-module-versions",
				data: {
					activityModule: activityModule.id as number,
					commit: commit.id as number,
					branch: branch.id as number,
					content,
					title,
					description,
					isCurrentHead: true,
					contentHash,
				},
				req: { transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return {
				activityModule: activityModule as ActivityModule,
				version: version as ActivityModuleVersion,
				commit: commit as Commit,
				branch: branch as Branch,
			};
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to create activity module`, {
			cause: error,
		}),
);

/**
 * Updates an activity module by creating a new version
 */
export const tryUpdateActivityModule = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		moduleSlug: string,
		args: UpdateActivityModuleArgs,
	) => {
		const {
			title,
			description,
			status,
			content,
			commitMessage = "Update activity module",
			branchName = "main",
			userId,
		} = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new Error("Transaction ID not found");
		}

		try {
			// Find activity module
			const modules = await payload.find({
				collection: "activity-modules",
				where: {
					slug: { equals: moduleSlug },
				},
				req: { transactionID },
			});

			if (modules.docs.length === 0) {
				throw new Error(`Activity module with slug '${moduleSlug}' not found`);
			}

			let activityModule = modules.docs[0];

			// Get branch
			const branchResult = await tryGetBranchByName(
				payload,
				branchName,
				transactionID,
			);
			if (!branchResult.ok) {
				throw branchResult.error;
			}
			const branch = branchResult.value;

			// Get current version to merge with updates
			const currentVersions = await payload.find({
				collection: "activity-module-versions",
				where: {
					and: [
						{ activityModule: { equals: activityModule.id } },
						{ branch: { equals: branch.id } },
						{ isCurrentHead: { equals: true } },
					],
				},
				req: { transactionID },
			});

			let currentContent = {};
			let currentTitle = activityModule.title;
			let currentDescription = activityModule.description;

			if (currentVersions.docs.length > 0) {
				const currentVersion = currentVersions.docs[0] as ActivityModuleVersion;
				currentContent = currentVersion.content || {};
				currentTitle = currentVersion.title;
				currentDescription = currentVersion.description;
			}

			// Merge updates
			const newContent = content
				? { ...currentContent, ...content }
				: currentContent;
			const newTitle = title || currentTitle;
			const newDescription =
				description !== undefined ? description : currentDescription;

			// Update activity module metadata if provided
			if (title || description !== undefined || status) {
				const updatedModule = await payload.update({
					collection: "activity-modules",
					id: activityModule.id as number,
					data: {
						...(title && { title }),
						...(description !== undefined && { description }),
						...(status && { status }),
					},
					req: { transactionID },
				});
				// Update the local reference
				activityModule = updatedModule;
			}

			// Generate hashes
			const contentHash = generateContentHash(newContent);
			const commitHash = generateCommitHash(
				newContent,
				commitMessage,
				userId,
				new Date(),
			);

			// Get parent commit (current head)
			let parentCommitId = null;
			if (currentVersions.docs.length > 0) {
				const currentVersion = currentVersions.docs[0] as ActivityModuleVersion;
				parentCommitId = currentVersion.commit as number;
			}

			// Create new commit
			const commit = await payload.create({
				collection: "commits",
				data: {
					hash: commitHash,
					message: commitMessage,
					author: userId,
					committer: userId,
					parentCommit: parentCommitId,
					isMergeCommit: false,
					commitDate: new Date().toISOString(),
				},
				req: { transactionID },
			});

			// Mark previous version as not current head
			if (currentVersions.docs.length > 0) {
				await payload.update({
					collection: "activity-module-versions",
					id: currentVersions.docs[0].id as number,
					data: {
						isCurrentHead: false,
					},
					req: { transactionID },
				});
			}

			// Create new version
			const version = await payload.create({
				collection: "activity-module-versions",
				data: {
					activityModule: activityModule.id as number,
					commit: commit.id as number,
					branch: branch.id as number,
					content: newContent,
					title: newTitle,
					description: newDescription,
					isCurrentHead: true,
					contentHash,
				},
				req: { transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return {
				activityModule: activityModule as ActivityModule,
				version: version as ActivityModuleVersion,
				commit: commit as Commit,
				branch: branch as Branch,
			};
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to update activity module`, {
			cause: error,
		}),
);

/**
 * Gets an activity module with its latest version (or specific version)
 */
export const tryGetActivityModule = Result.wrap(
	async (payload: Payload, args: GetActivityModuleArgs) => {
		const { slug, id, branchName = "main", commitHash } = args;

		if (!slug && !id) {
			throw new Error("Either slug or id must be provided");
		}

		// Find activity module
		let activityModule: ActivityModule;
		if (slug) {
			const modules = await payload.find({
				collection: "activity-modules",
				where: {
					slug: { equals: slug },
				},
			});

			if (modules.docs.length === 0) {
				throw new Error(`Activity module with slug '${slug}' not found`);
			}
			activityModule = modules.docs[0] as ActivityModule;
		} else {
			const module = await payload.findByID({
				collection: "activity-modules",
				id: id as number,
			});
			if (!module) {
				throw new Error(`Activity module with id '${id}' not found`);
			}
			activityModule = module as ActivityModule;
		}

		// Get branch
		const branchResult = await tryGetBranchByName(payload, branchName);
		if (!branchResult.ok) {
			throw branchResult.error;
		}
		const branch = branchResult.value;

		// Build version query
		const versionWhere: any = {
			and: [
				{ activityModule: { equals: activityModule.id } },
				{ branch: { equals: branch.id } },
			],
		};

		if (commitHash) {
			// Find specific commit
			const commits = await payload.find({
				collection: "commits",
				where: {
					hash: { equals: commitHash },
				},
			});

			if (commits.docs.length === 0) {
				throw new Error(`Commit with hash '${commitHash}' not found`);
			}

			versionWhere.and.push({ commit: { equals: commits.docs[0].id } });
		} else {
			// Get current head
			versionWhere.and.push({ isCurrentHead: { equals: true } });
		}

		// Find version
		const versions = await payload.find({
			collection: "activity-module-versions",
			where: versionWhere,
			populate: {
				commits: {
					hash: true,
					message: true,
					author: true,
					commitDate: true,
				},
			},
		});

		if (versions.docs.length === 0) {
			throw new Error(
				`No version found for activity module on branch '${branchName}'`,
			);
		}

		const version = versions.docs[0] as ActivityModuleVersion;

		return {
			activityModule,
			version,
			branch,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to get activity module`, {
			cause: error,
		}),
);

/**
 * Searches activity modules with filters
 */
export const trySearchActivityModules = Result.wrap(
	async (payload: Payload, args: SearchActivityModulesArgs = {}) => {
		const {
			title,
			type,
			status,
			createdBy,
			branchName = "main",
			limit = 10,
			page = 1,
		} = args;

		// Get branch
		const branchResult = await tryGetBranchByName(payload, branchName);
		if (!branchResult.ok) {
			throw branchResult.error;
		}
		const branch = branchResult.value;

		// Build activity module query
		const moduleWhere: any = {};

		if (title) {
			moduleWhere.title = { contains: title };
		}

		if (type) {
			moduleWhere.type = { equals: type };
		}

		if (status) {
			moduleWhere.status = { equals: status };
		}

		if (createdBy) {
			moduleWhere.createdBy = { equals: createdBy };
		}

		// Find activity modules
		const modules = await payload.find({
			collection: "activity-modules",
			where: moduleWhere,
			limit,
			page,
			sort: "-createdAt",
		});

		// Get current versions for each module
		const modulesWithVersions = await Promise.all(
			modules.docs.map(async (module) => {
				const versions = await payload.find({
					collection: "activity-module-versions",
					where: {
						and: [
							{ activityModule: { equals: module.id } },
							{ branch: { equals: branch.id } },
							{ isCurrentHead: { equals: true } },
						],
					},
					populate: {
						commits: {
							hash: true,
							message: true,
							author: true,
							commitDate: true,
						},
					},
				});

				return {
					activityModule: module as ActivityModule,
					version: (versions.docs[0] as ActivityModuleVersion) || null,
				};
			}),
		);

		return {
			docs: modulesWithVersions,
			totalDocs: modules.totalDocs,
			totalPages: modules.totalPages,
			page: modules.page,
			limit: modules.limit,
			hasNextPage: modules.hasNextPage,
			hasPrevPage: modules.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to search activity modules:`, {
			cause: error,
		}),
);

/**
 * Merges a source branch into a target branch
 */
export const tryMergeBranch = Result.wrap(
	async (payload: Payload, args: MergeBranchArgs) => {
		const {
			sourceBranch: sourceBranchName,
			targetBranch: targetBranchName,
			mergeMessage = `Merge ${sourceBranchName} into ${targetBranchName}`,
			userId,
		} = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new Error("Transaction ID not found");
		}

		try {
			// Get source and target branches
			const sourceBranchResult = await tryGetBranchByName(
				payload,
				sourceBranchName,
				transactionID,
			);
			const targetBranchResult = await tryGetBranchByName(
				payload,
				targetBranchName,
				transactionID,
			);

			if (!sourceBranchResult.ok) {
				throw sourceBranchResult.error;
			}
			if (!targetBranchResult.ok) {
				throw targetBranchResult.error;
			}

			const sourceBranch = sourceBranchResult.value;
			const targetBranch = targetBranchResult.value;

			// Get all current head versions from source branch
			const sourceVersions = await payload.find({
				collection: "activity-module-versions",
				where: {
					and: [
						{ branch: { equals: sourceBranch.id } },
						{ isCurrentHead: { equals: true } },
					],
				},
				req: { transactionID },
			});

			// Get all current head versions from target branch
			const targetVersions = await payload.find({
				collection: "activity-module-versions",
				where: {
					and: [
						{ branch: { equals: targetBranch.id } },
						{ isCurrentHead: { equals: true } },
					],
				},
				req: { transactionID },
			});

			// Create a map of target branch activity modules for quick lookup
			const targetModuleMap = new Map();
			for (const version of targetVersions.docs) {
				const v = version as ActivityModuleVersion;
				targetModuleMap.set(v.activityModule as number, v);
			}

			const mergedVersions = [];
			const newCommits = [];

			// Process each source version
			for (const sourceVersion of sourceVersions.docs) {
				const sourceV = sourceVersion as ActivityModuleVersion;
				const moduleId = sourceV.activityModule as number;
				const targetV = targetModuleMap.get(moduleId);

				if (!targetV) {
					// Module doesn't exist in target branch - copy it over
					const newVersion = await payload.create({
						collection: "activity-module-versions",
						data: {
							activityModule: sourceV.activityModule as number,
							commit: sourceV.commit as number,
							branch: targetBranch.id as number,
							content: sourceV.content,
							title: sourceV.title,
							description: sourceV.description,
							isCurrentHead: true,
							contentHash: sourceV.contentHash,
						},
						req: { transactionID },
					});
					mergedVersions.push(newVersion);
				} else {
					// Module exists in both branches - check if source is newer
					const sourceCommit = await payload.findByID({
						collection: "commits",
						id: sourceV.commit as number,
						req: { transactionID },
					});
					const targetCommit = await payload.findByID({
						collection: "commits",
						id: targetV.commit as number,
						req: { transactionID },
					});

					if (!sourceCommit || !targetCommit) {
						throw new Error("Failed to find commit information");
					}

					const sourceDate = new Date(sourceCommit.commitDate);
					const targetDate = new Date(targetCommit.commitDate);

					// If source is newer, create a merge commit
					if (sourceDate > targetDate) {
						// Generate merge commit hash
						const mergeCommitHash = generateCommitHash(
							(sourceV.content as Record<string, unknown>) || {},
							mergeMessage,
							userId,
							new Date(),
						);

						// Create merge commit with both parents
						const mergeCommit = await payload.create({
							collection: "commits",
							data: {
								hash: mergeCommitHash,
								message: mergeMessage,
								author: userId,
								committer: userId,
								parentCommit: targetV.commit as number,
								isMergeCommit: true,
								commitDate: new Date().toISOString(),
							},
							req: { transactionID },
						});

						// Create commit parent relationship for the source commit
						await payload.create({
							collection: "commit-parents",
							data: {
								commit: mergeCommit.id as number,
								parentCommit: sourceV.commit as number,
								parentOrder: 1, // Second parent (first parent is already set in the commit record)
							},
							req: { transactionID },
						});

						// Mark current target version as not head
						await payload.update({
							collection: "activity-module-versions",
							id: targetV.id as number,
							data: {
								isCurrentHead: false,
							},
							req: { transactionID },
						});

						// Create new version in target branch
						const newVersion = await payload.create({
							collection: "activity-module-versions",
							data: {
								activityModule: sourceV.activityModule as number,
								commit: mergeCommit.id as number,
								branch: targetBranch.id as number,
								content: sourceV.content,
								title: sourceV.title,
								description: sourceV.description,
								isCurrentHead: true,
								contentHash: sourceV.contentHash,
							},
							req: { transactionID },
						});

						mergedVersions.push(newVersion);
						newCommits.push(mergeCommit);
					}
					// If target is newer or equal, no merge needed for this module
				}
			}

			await payload.db.commitTransaction(transactionID);

			return {
				sourceBranch,
				targetBranch,
				mergedVersionsCount: mergedVersions.length,
				newCommitsCount: newCommits.length,
			};
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to merge branch`, {
			cause: error,
		}),
);

/**
 * Gets all branches that contain versions of a specific activity module
 */
export const tryGetBranchesForModule = Result.wrap(
	async (payload: Payload, args: GetBranchesForModuleArgs) => {
		const { moduleSlug, moduleId } = args;

		if (!moduleSlug && !moduleId) {
			throw new Error("Either moduleSlug or moduleId must be provided");
		}

		// Find activity module
		let activityModule: ActivityModule;
		if (moduleSlug) {
			const modules = await payload.find({
				collection: "activity-modules",
				where: {
					slug: { equals: moduleSlug },
				},
			});

			if (modules.docs.length === 0) {
				throw new Error(`Activity module with slug '${moduleSlug}' not found`);
			}
			activityModule = modules.docs[0] as ActivityModule;
		} else {
			const module = await payload.findByID({
				collection: "activity-modules",
				id: moduleId as number,
			});
			if (!module) {
				throw new Error(`Activity module with id '${moduleId}' not found`);
			}
			activityModule = module as ActivityModule;
		}

		// Find all versions of this module
		const versions = await payload.find({
			collection: "activity-module-versions",
			where: {
				activityModule: { equals: activityModule.id },
			},
			populate: {
				branches: {
					name: true,
					description: true,
					isDefault: true,
					createdBy: true,
				},
			},
		});

		// Extract unique branches
		const branchMap = new Map();
		for (const version of versions.docs) {
			const v = version as ActivityModuleVersion;
			const branch = v.branch;
			if (typeof branch === "object" && branch !== null && "name" in branch) {
				branchMap.set(branch.id, branch);
			}
		}

		return {
			activityModule,
			branches: Array.from(branchMap.values()) as Branch[],
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to get branches for module`, {
			cause: error,
		}),
);

/**
 * Deletes a branch and all its versions
 */
export const tryDeleteBranch = Result.wrap(
	async (payload: Payload, branchName: string, userId: number) => {
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new Error("Transaction ID not found");
		}

		try {
			// Get branch
			const branchResult = await tryGetBranchByName(
				payload,
				branchName,
				transactionID,
			);
			if (!branchResult.ok) {
				throw branchResult.error;
			}
			const branch = branchResult.value;

			// Cannot delete main branch
			if (branch.isDefault) {
				throw new Error("Cannot delete the default branch");
			}

			// Find all versions in this branch
			const versions = await payload.find({
				collection: "activity-module-versions",
				where: {
					branch: { equals: branch.id },
				},
				req: { transactionID },
			});

			// Delete all versions
			for (const version of versions.docs) {
				await payload.delete({
					collection: "activity-module-versions",
					id: version.id as number,
					req: { transactionID },
				});
			}

			// Delete branch
			const deletedBranch = await payload.delete({
				collection: "branches",
				id: branch.id as number,
				req: { transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return deletedBranch as Branch;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to delete branch`, {
			cause: error,
		}),
);

/**
 * Deletes an activity module and all its versions
 */
export const tryDeleteActivityModule = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		moduleSlug: string,
		userId: number,
	) => {
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new Error("Transaction ID not found");
		}

		try {
			// Find activity module
			const modules = await payload.find({
				collection: "activity-modules",
				where: {
					slug: { equals: moduleSlug },
				},
				req: { transactionID },
			});

			if (modules.docs.length === 0) {
				throw new Error(`Activity module with slug '${moduleSlug}' not found`);
			}

			const activityModule = modules.docs[0] as ActivityModule;

			// Find all versions
			const versions = await payload.find({
				collection: "activity-module-versions",
				where: {
					activityModule: { equals: activityModule.id },
				},
				req: { transactionID },
			});

			// Delete all versions
			for (const version of versions.docs) {
				await payload.delete({
					collection: "activity-module-versions",
					id: version.id as number,
					req: { transactionID },
				});
			}

			// Delete activity module
			const deletedModule = await payload.delete({
				collection: "activity-modules",
				id: activityModule.id as number,
				req: { transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return deletedModule as ActivityModule;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to delete activity module:`, {
			cause: error,
		}),
);
