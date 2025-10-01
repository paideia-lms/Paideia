import { Result } from "typescript-result";
import {
	DuplicateBranchError,
	NonExistingSourceError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { ActivityModule } from "../payload-types";
import {
	generateCommitHash,
	generateContentHash,
} from "./activity-module-management";
import type { IActivityModuleStorage } from "./activity-module-storage";

export interface CreateActivityModuleArgs {
	slug: string;
	title: string;
	description?: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	content: Record<string, unknown>;
	commitMessage?: string;
	branchName?: string;
	userId: number;
}

export interface UpdateActivityModuleArgs {
	title?: string;
	description?: string;
	status?: "draft" | "published" | "archived";
	content?: Record<string, unknown>;
	commitMessage?: string;
	branchName?: string;
	userId: number;
}

export interface SearchActivityModulesArgs {
	title?: string;
	type?: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	createdBy?: number;
	branchName?: string;
	limit?: number;
	page?: number;
}

export interface GetActivityModuleArgs {
	slug?: string;
	id?: number;
	branchName?: string;
	commitHash?: string;
}

export interface CreateBranchArgs {
	branchName: string;
	description?: string;
	fromBranch?: string;
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
 * Activity Module Manager
 * Storage-agnostic business logic for managing activity modules
 */
export class ActivityModuleManager {
	constructor(private storage: IActivityModuleStorage) {}

	/**
	 * Get or create the main branch
	 */
	private tryGetOrCreateMainBranch = Result.wrap(
		async (userId: number, transactionID: string | number) => {
			const existingBranches = await this.storage.findBranches(
				{
					where: {
						name: { equals: "main" },
					},
				},
				transactionID,
			);

			if (existingBranches.docs.length > 0) {
				return existingBranches.docs[0];
			}

			const mainBranch = await this.storage.createBranch(
				{
					name: "main",
					description: "Main branch",
					isDefault: true,
					createdBy: userId,
				},
				transactionID,
			);

			return mainBranch;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get or create main branch", {
				cause: error,
			}),
	);

	/**
	 * Get branch by name
	 */
	private tryGetBranchByName = Result.wrap(
		async (branchName: string, transactionID?: string | number) => {
			const branches = await this.storage.findBranches(
				{
					where: {
						name: { equals: branchName },
					},
				},
				transactionID,
			);

			if (branches.docs.length === 0) {
				throw new NonExistingSourceError(`Branch '${branchName}' not found`);
			}

			return branches.docs[0];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get branch", {
				cause: error,
			}),
	);

	/**
	 * Creates a new branch from an existing branch
	 */
	tryCreateBranch = Result.wrap(
		async (args: CreateBranchArgs) => {
			const { branchName, description, fromBranch = "main", userId } = args;

			const transactionID = await this.storage.beginTransaction();

			try {
				// Check if branch already exists
				const existingBranches = await this.storage.findBranches(
					{
						where: {
							name: { equals: branchName },
						},
					},
					transactionID,
				);

				if (existingBranches.docs.length > 0) {
					throw new DuplicateBranchError(
						`Branch '${branchName}' already exists`,
					);
				}

				// Get the source branch
				const sourceBranchResult = await this.tryGetBranchByName(
					fromBranch,
					transactionID,
				);
				if (!sourceBranchResult.ok) {
					throw sourceBranchResult.error;
				}
				const sourceBranch = sourceBranchResult.value;

				// Create new branch
				const newBranch = await this.storage.createBranch(
					{
						name: branchName,
						description: description || `Branch created from ${fromBranch}`,
						isDefault: false,
						createdBy: userId,
					},
					transactionID,
				);

				// Get all current head versions from the source branch
				const sourceVersions = await this.storage.findActivityModuleVersions(
					{
						where: {
							and: [
								{ branch: { equals: sourceBranch.id } },
								{ isCurrentHead: { equals: true } },
							],
						},
					},
					transactionID,
				);

				// Copy all current head versions to the new branch
				const copiedVersions = [];
				for (const sourceVersion of sourceVersions.docs) {
					const versionContent = sourceVersion.content;
					const content: Record<string, unknown> =
						typeof versionContent === "object" &&
						versionContent !== null &&
						!Array.isArray(versionContent)
							? (versionContent as Record<string, unknown>)
							: {};

					const newVersion = await this.storage.createActivityModuleVersion(
						{
							activityModule: sourceVersion.activityModule as number,
							commit: sourceVersion.commit as number,
							branch: newBranch.id,
							content,
							title: sourceVersion.title ?? "",
							description: sourceVersion.description ?? undefined,
							isCurrentHead: true,
							contentHash: sourceVersion.contentHash ?? "",
						},
						transactionID,
					);

					copiedVersions.push(newVersion);
				}

				await this.storage.commitTransaction(transactionID);

				return {
					branch: newBranch,
					sourceBranch: sourceBranch,
					copiedVersionsCount: copiedVersions.length,
				};
			} catch (error) {
				await this.storage.rollbackTransaction(transactionID);
				throw error;
			}
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create branch", {
				cause: error,
			}),
	);

	/**
	 * Creates a new activity module with initial version
	 */
	tryCreateActivityModule = Result.wrap(
		async (args: CreateActivityModuleArgs) => {
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

			const transactionID = await this.storage.beginTransaction();

			try {
				// Check if activity module with slug already exists
				const existingModules = await this.storage.findActivityModules(
					{
						where: {
							slug: { equals: slug },
						},
					},
					transactionID,
				);

				if (existingModules.docs.length > 0) {
					throw new Error(`Activity module with slug '${slug}' already exists`);
				}

				// Get or create branch
				const branchResult =
					branchName === "main"
						? await this.tryGetOrCreateMainBranch(userId, transactionID)
						: await this.tryGetBranchByName(branchName, transactionID);

				if (!branchResult.ok) {
					throw branchResult.error;
				}
				const branch = branchResult.value;

				// Create activity module
				const activityModule = await this.storage.createActivityModule(
					{
						slug,
						title,
						description,
						type,
						status,
						createdBy: userId,
					},
					transactionID,
				);

				// Generate hashes
				const contentHash = generateContentHash(content);
				const commitHash = generateCommitHash(
					content,
					commitMessage,
					userId,
					new Date(),
				);

				// Create commit
				const commit = await this.storage.createCommit(
					{
						hash: commitHash,
						message: commitMessage,
						author: userId,
						committer: userId,
						isMergeCommit: false,
						commitDate: new Date().toISOString(),
					},
					transactionID,
				);

				// Create activity module version
				const version = await this.storage.createActivityModuleVersion(
					{
						activityModule: activityModule.id,
						commit: commit.id,
						branch: branch.id,
						content,
						title,
						description,
						isCurrentHead: true,
						contentHash,
					},
					transactionID,
				);

				await this.storage.commitTransaction(transactionID);

				return {
					activityModule: activityModule,
					version: version,
					commit: commit,
					branch: branch,
				};
			} catch (error) {
				await this.storage.rollbackTransaction(transactionID);
				throw error;
			}
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create activity module", {
				cause: error,
			}),
	);

	/**
	 * Updates an activity module by creating a new version
	 */
	tryUpdateActivityModule = Result.wrap(
		async (moduleSlug: string, args: UpdateActivityModuleArgs) => {
			const {
				title,
				description,
				status,
				content,
				commitMessage = "Update activity module",
				branchName = "main",
				userId,
			} = args;

			const transactionID = await this.storage.beginTransaction();

			try {
				// Find activity module
				const modules = await this.storage.findActivityModules(
					{
						where: {
							slug: { equals: moduleSlug },
						},
					},
					transactionID,
				);

				if (modules.docs.length === 0) {
					throw new Error(
						`Activity module with slug '${moduleSlug}' not found`,
					);
				}

				let activityModule = modules.docs[0];

				// Get branch
				const branchResult = await this.tryGetBranchByName(
					branchName,
					transactionID,
				);
				if (!branchResult.ok) {
					throw branchResult.error;
				}
				const branch = branchResult.value;

				// Get current version to merge with updates
				const currentVersions = await this.storage.findActivityModuleVersions(
					{
						where: {
							and: [
								{ activityModule: { equals: activityModule.id } },
								{ branch: { equals: branch.id } },
								{ isCurrentHead: { equals: true } },
							],
						},
					},
					transactionID,
				);

				let currentContent: Record<string, unknown> = {};
				let currentTitle = activityModule.title;
				let currentDescription = activityModule.description;

				if (currentVersions.docs.length > 0) {
					const currentVersion = currentVersions.docs[0];
					const versionContent = currentVersion.content;
					if (
						typeof versionContent === "object" &&
						versionContent !== null &&
						!Array.isArray(versionContent)
					) {
						currentContent = versionContent as Record<string, unknown>;
					}
					currentTitle = currentVersion.title;
					currentDescription = currentVersion.description ?? undefined;
				}

				// Merge updates
				const newContent = content
					? { ...currentContent, ...content }
					: currentContent;
				const newTitle = title || currentTitle || "";
				const newDescription =
					description !== undefined ? description : currentDescription;

				// Update activity module metadata if provided
				if (title || description !== undefined || status) {
					const updatedModule = await this.storage.updateActivityModule(
						activityModule.id,
						{
							...(title && { title }),
							...(description !== undefined && { description }),
							...(status && { status }),
						},
						transactionID,
					);
					activityModule = updatedModule;
				}

				// Get parent commit (current head)
				let parentCommitId: number | null = null;
				let parentCommitHash: string | undefined;
				if (currentVersions.docs.length > 0) {
					const currentVersion = currentVersions.docs[0];
					parentCommitId = currentVersion.commit as number;
					const parentCommit = await this.storage.findCommitById(
						parentCommitId,
						transactionID,
					);
					if (parentCommit) {
						parentCommitHash = parentCommit.hash;
					}
				}

				// Generate hashes
				const contentHash = generateContentHash(newContent);
				const commitHash = generateCommitHash(
					newContent,
					commitMessage,
					userId,
					new Date(),
					parentCommitHash,
				);

				// Create new commit
				const commit = await this.storage.createCommit(
					{
						hash: commitHash,
						message: commitMessage,
						author: userId,
						committer: userId,
						parentCommit: parentCommitId,
						isMergeCommit: false,
						commitDate: new Date().toISOString(),
					},
					transactionID,
				);

				// Mark previous version as not current head
				if (currentVersions.docs.length > 0) {
					await this.storage.updateActivityModuleVersion(
						currentVersions.docs[0].id,
						{
							isCurrentHead: false,
						},
						transactionID,
					);
				}

				// Create new version
				const version = await this.storage.createActivityModuleVersion(
					{
						activityModule: activityModule.id,
						commit: commit.id,
						branch: branch.id,
						content: newContent,
						title: newTitle,
						description: newDescription ?? undefined,
						isCurrentHead: true,
						contentHash,
					},
					transactionID,
				);

				await this.storage.commitTransaction(transactionID);

				return {
					activityModule: activityModule,
					version: version,
					commit: commit,
					branch: branch,
				};
			} catch (error) {
				await this.storage.rollbackTransaction(transactionID);
				throw error;
			}
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update activity module", {
				cause: error,
			}),
	);

	/**
	 * Gets an activity module with its latest version (or specific version)
	 */
	tryGetActivityModule = Result.wrap(
		async (args: GetActivityModuleArgs) => {
			const { slug, id, branchName = "main", commitHash } = args;

			// Find activity module
			let activityModule: ActivityModule | undefined;
			if (slug) {
				const modules = await this.storage.findActivityModules({
					where: {
						slug: { equals: slug },
					},
				});

				if (modules.docs.length === 0) {
					throw new Error(`Activity module with slug '${slug}' not found`);
				}
				activityModule = modules.docs[0];
			} else if (id) {
				const module = await this.storage.findActivityModuleById(id);
				if (!module) {
					throw new Error(`Activity module with id '${id}' not found`);
				}
				activityModule = module;
			} else {
				throw new Error("Either slug or id must be provided");
			}

			if (!activityModule) {
				throw new Error("Activity module not found");
			}

			// Get branch
			const branchResult = await this.tryGetBranchByName(branchName);
			if (!branchResult.ok) {
				throw branchResult.error;
			}
			const branch = branchResult.value;

			// Build version query
			const versionWhere: {
				and: Array<Record<string, unknown>>;
			} = {
				and: [
					{ activityModule: { equals: activityModule.id } },
					{ branch: { equals: branch.id } },
				],
			};

			if (commitHash) {
				// Find specific commit
				const commits = await this.storage.findCommits({
					where: {
						hash: { equals: commitHash },
					},
				});

				if (commits.docs.length === 0) {
					throw new Error(`Commit with hash '${commitHash}' not found`);
				}

				versionWhere.and.push({
					commit: { equals: commits.docs[0].id },
				});
			} else {
				// Get current head
				versionWhere.and.push({
					isCurrentHead: { equals: true },
				});
			}

			// Find version
			const versions = await this.storage.findActivityModuleVersions({
				where: versionWhere,
			});

			if (versions.docs.length === 0) {
				throw new Error(
					`No version found for activity module on branch '${branchName}'`,
				);
			}

			const version = versions.docs[0];

			return {
				activityModule,
				version,
				branch,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get activity module", {
				cause: error,
			}),
	);

	/**
	 * Searches activity modules with filters
	 */
	trySearchActivityModules = Result.wrap(
		async (args: SearchActivityModulesArgs = {}) => {
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
			const branchResult = await this.tryGetBranchByName(branchName);
			if (!branchResult.ok) {
				throw branchResult.error;
			}
			const branch = branchResult.value;

			// Build activity module query
			const moduleWhere: Record<string, unknown> = {};

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
			const modules = await this.storage.findActivityModules({
				where: moduleWhere,
				limit,
				page,
				sort: "-createdAt",
			});

			// Get current versions for each module
			const modulesWithVersions = await Promise.all(
				modules.docs.map(async (module) => {
					const versions = await this.storage.findActivityModuleVersions({
						where: {
							and: [
								{ activityModule: { equals: module.id } },
								{ branch: { equals: branch.id } },
								{ isCurrentHead: { equals: true } },
							],
						},
					});

					return {
						activityModule: module,
						version: versions.docs[0] || null,
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
			new UnknownError("Failed to search activity modules:", {
				cause: error,
			}),
	);

	/**
	 * Merges a source branch into a target branch
	 */
	tryMergeBranch = Result.wrap(
		async (args: MergeBranchArgs) => {
			const {
				sourceBranch: sourceBranchName,
				targetBranch: targetBranchName,
				mergeMessage = `Merge ${sourceBranchName} into ${targetBranchName}`,
				userId,
			} = args;

			const transactionID = await this.storage.beginTransaction();

			try {
				// Get source and target branches
				const sourceBranchResult = await this.tryGetBranchByName(
					sourceBranchName,
					transactionID,
				);
				const targetBranchResult = await this.tryGetBranchByName(
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
				const sourceVersions = await this.storage.findActivityModuleVersions(
					{
						where: {
							and: [
								{ branch: { equals: sourceBranch.id } },
								{ isCurrentHead: { equals: true } },
							],
						},
					},
					transactionID,
				);

				// Get all current head versions from target branch
				const targetVersions = await this.storage.findActivityModuleVersions(
					{
						where: {
							and: [
								{ branch: { equals: targetBranch.id } },
								{ isCurrentHead: { equals: true } },
							],
						},
					},
					transactionID,
				);

				// Create a map of target branch activity modules for quick lookup
				const targetModuleMap = new Map();
				for (const version of targetVersions.docs) {
					targetModuleMap.set(version.activityModule, version);
				}

				const mergedVersions = [];
				const newCommits = [];

				// Process each source version
				for (const sourceVersion of sourceVersions.docs) {
					const moduleId = sourceVersion.activityModule;
					const targetVersion = targetModuleMap.get(moduleId);

					if (!targetVersion) {
						const sourceContent = sourceVersion.content as Record<
							string,
							unknown
						>;
						if (
							!(
								typeof sourceContent === "object" &&
								!Array.isArray(sourceContent)
							)
						) {
							throw new Error("Source content is not an object");
						}

						// Module doesn't exist in target branch - copy it over
						// Get source commit hash for parent
						const sourceCommitId = sourceVersion.commit as number;
						const sourceCommit = await this.storage.findCommitById(
							sourceCommitId,
							transactionID,
						);
						const sourceCommitHash = sourceCommit?.hash;

						const copyCommitHash = generateCommitHash(
							sourceContent || {},
							`Copy from ${sourceBranchName}`,
							userId,
							new Date(),
							sourceCommitHash,
						);

						const copyCommit = await this.storage.createCommit(
							{
								hash: copyCommitHash,
								message: `Copy from ${sourceBranchName}`,
								author: userId,
								committer: userId,
								parentCommit: sourceVersion.commit as number,
								isMergeCommit: false,
								commitDate: new Date().toISOString(),
							},
							transactionID,
						);

						const newVersion = await this.storage.createActivityModuleVersion(
							{
								activityModule: sourceVersion.activityModule as number,
								commit: copyCommit.id,
								branch: targetBranch.id,
								content: sourceContent,
								title: sourceVersion.title ?? "",
								description: sourceVersion.description ?? undefined,
								isCurrentHead: true,
								contentHash: sourceVersion.contentHash ?? "",
							},
							transactionID,
						);
						mergedVersions.push(newVersion);
						newCommits.push(copyCommit);
					} else {
						// Module exists in both branches - check if source is newer
						const sourceCommit = await this.storage.findCommitById(
							sourceVersion.commit as number,
							transactionID,
						);
						const targetCommit = await this.storage.findCommitById(
							targetVersion.commit as number,
							transactionID,
						);

						if (!sourceCommit || !targetCommit) {
							throw new Error("Failed to find commit information");
						}

						const sourceDate = new Date(sourceCommit.commitDate);
						const targetDate = new Date(targetCommit.commitDate);

						// If source is newer or equal (with different content hash), create a merge commit
						if (
							sourceDate >= targetDate &&
							sourceVersion.contentHash !== targetVersion.contentHash
						) {
							const sourceContent = sourceVersion.content as Record<
								string,
								unknown
							>;

							if (
								!(
									typeof sourceContent === "object" &&
									!Array.isArray(sourceContent)
								)
							) {
								throw new Error("Source content is not an object");
							}

							// Get target commit hash for parent
							const targetCommitId = targetVersion.commit as number;
							const targetCommitObj = await this.storage.findCommitById(
								targetCommitId,
								transactionID,
							);
							const targetCommitHash = targetCommitObj?.hash;

							// Generate merge commit hash
							const mergeCommitHash = generateCommitHash(
								sourceContent || {},
								mergeMessage,
								userId,
								new Date(),
								targetCommitHash,
							);

							// Create merge commit with both parents
							const mergeCommit = await this.storage.createCommit(
								{
									hash: mergeCommitHash,
									message: mergeMessage,
									author: userId,
									committer: userId,
									parentCommit: targetVersion.commit as number,
									isMergeCommit: true,
									commitDate: new Date().toISOString(),
								},
								transactionID,
							);

							// Create commit parent relationship for the source commit
							await this.storage.createCommitParent(
								{
									commit: mergeCommit.id,
									parentCommit: sourceVersion.commit as number,
									parentOrder: 1,
								},
								transactionID,
							);

							// Mark current target version as not head
							await this.storage.updateActivityModuleVersion(
								targetVersion.id,
								{
									isCurrentHead: false,
								},
								transactionID,
							);

							// Create new version in target branch
							const newVersion = await this.storage.createActivityModuleVersion(
								{
									activityModule: sourceVersion.activityModule as number,
									commit: mergeCommit.id,
									branch: targetBranch.id,
									content: sourceContent,
									title: sourceVersion.title ?? "",
									description: sourceVersion.description ?? undefined,
									isCurrentHead: true,
									contentHash: sourceVersion.contentHash ?? "",
								},
								transactionID,
							);

							mergedVersions.push(newVersion);
							newCommits.push(mergeCommit);
						}
					}
				}

				await this.storage.commitTransaction(transactionID);

				return {
					sourceBranch,
					targetBranch,
					mergedVersionsCount: mergedVersions.length,
					newCommitsCount: newCommits.length,
				};
			} catch (error) {
				await this.storage.rollbackTransaction(transactionID);
				throw error;
			}
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to merge branch", {
				cause: error,
			}),
	);

	/**
	 * Deletes a branch and all its versions
	 */
	tryDeleteBranch = Result.wrap(
		async (branchName: string) => {
			const transactionID = await this.storage.beginTransaction();

			try {
				// Get branch
				const branchResult = await this.tryGetBranchByName(
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
				const versions = await this.storage.findActivityModuleVersions(
					{
						where: {
							branch: { equals: branch.id },
						},
					},
					transactionID,
				);

				// Delete all versions
				for (const version of versions.docs) {
					await this.storage.deleteActivityModuleVersion(
						version.id,
						transactionID,
					);
				}

				// Delete branch
				const deletedBranch = await this.storage.deleteBranch(
					branch.id,
					transactionID,
				);

				await this.storage.commitTransaction(transactionID);

				return deletedBranch;
			} catch (error) {
				await this.storage.rollbackTransaction(transactionID);
				throw error;
			}
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete branch", {
				cause: error,
			}),
	);

	/**
	 * Deletes an activity module and all its versions
	 */
	tryDeleteActivityModule = Result.wrap(
		async (moduleSlug: string) => {
			const transactionID = await this.storage.beginTransaction();

			try {
				// Find activity module
				const modules = await this.storage.findActivityModules(
					{
						where: {
							slug: { equals: moduleSlug },
						},
					},
					transactionID,
				);

				if (modules.docs.length === 0) {
					throw new Error(
						`Activity module with slug '${moduleSlug}' not found`,
					);
				}

				const activityModule = modules.docs[0];

				// Find all versions
				const versions = await this.storage.findActivityModuleVersions(
					{
						where: {
							activityModule: { equals: activityModule.id },
						},
					},
					transactionID,
				);

				// Delete all versions
				for (const version of versions.docs) {
					await this.storage.deleteActivityModuleVersion(
						version.id,
						transactionID,
					);
				}

				// Delete activity module
				const deletedModule = await this.storage.deleteActivityModule(
					activityModule.id,
					transactionID,
				);

				await this.storage.commitTransaction(transactionID);

				return deletedModule;
			} catch (error) {
				await this.storage.rollbackTransaction(transactionID);
				throw error;
			}
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete activity module:", {
				cause: error,
			}),
	);
}
