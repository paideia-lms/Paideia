import type {
	ActivityModule,
	ActivityModuleVersion,
	Branch,
	Commit,
	CommitParent,
} from "../payload-types";
import type {
	CreateActivityModuleData,
	CreateActivityModuleVersionData,
	CreateBranchData,
	CreateCommitData,
	CreateCommitParentData,
	FindOptions,
	FindResult,
	IActivityModuleStorage,
	UpdateActivityModuleData,
} from "./activity-module-storage";

/**
 * In-memory storage implementation for testing
 */
export class InMemoryActivityModuleStorage implements IActivityModuleStorage {
	private branches: Map<number, Branch> = new Map();
	private activityModules: Map<number, ActivityModule> = new Map();
	private commits: Map<number, Commit> = new Map();
	private activityModuleVersions: Map<number, ActivityModuleVersion> =
		new Map();
	private commitParents: Map<number, CommitParent> = new Map();

	private nextBranchId = 1;
	private nextActivityModuleId = 1;
	private nextCommitId = 1;
	private nextActivityModuleVersionId = 1;
	private nextCommitParentId = 1;

	private transactionId = 0;
	private transactionData: Map<
		string | number,
		{
			branches: Map<number, Branch>;
			activityModules: Map<number, ActivityModule>;
			commits: Map<number, Commit>;
			activityModuleVersions: Map<number, ActivityModuleVersion>;
			commitParents: Map<number, CommitParent>;
		}
	> = new Map();

	async beginTransaction(): Promise<string | number> {
		this.transactionId++;
		const txId = this.transactionId;

		// Clone current state for transaction
		this.transactionData.set(txId, {
			branches: new Map(this.branches),
			activityModules: new Map(this.activityModules),
			commits: new Map(this.commits),
			activityModuleVersions: new Map(this.activityModuleVersions),
			commitParents: new Map(this.commitParents),
		});

		return txId;
	}

	async commitTransaction(transactionID: string | number): Promise<void> {
		const txData = this.transactionData.get(transactionID);
		if (!txData) {
			throw new Error("Transaction not found");
		}

		// Apply transaction changes to main storage
		this.branches = txData.branches;
		this.activityModules = txData.activityModules;
		this.commits = txData.commits;
		this.activityModuleVersions = txData.activityModuleVersions;
		this.commitParents = txData.commitParents;

		this.transactionData.delete(transactionID);
	}

	async rollbackTransaction(transactionID: string | number): Promise<void> {
		this.transactionData.delete(transactionID);
	}

	private getStorage(transactionID?: string | number) {
		if (transactionID !== undefined) {
			const txData = this.transactionData.get(transactionID);
			if (!txData) {
				throw new Error("Transaction not found");
			}
			return txData;
		}
		return {
			branches: this.branches,
			activityModules: this.activityModules,
			commits: this.commits,
			activityModuleVersions: this.activityModuleVersions,
			commitParents: this.commitParents,
		};
	}

	// Branch operations
	async findBranches(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<Branch>> {
		const storage = this.getStorage(transactionID);
		let docs = Array.from(storage.branches.values());

		// Apply where filter
		if (options.where) {
			docs = this.applyWhereFilter(docs, options.where);
		}

		// Apply pagination
		const limit = options.limit || 10;
		const page = options.page || 1;
		const totalDocs = docs.length;
		const totalPages = Math.ceil(totalDocs / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		docs = docs.slice(startIndex, endIndex);

		return {
			docs,
			totalDocs,
			totalPages,
			page,
			limit,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
		};
	}

	async createBranch(
		data: CreateBranchData,
		transactionID?: string | number,
	): Promise<Branch> {
		const storage = this.getStorage(transactionID);

		// Enforce unique constraint: name
		const existingBranch = Array.from(storage.branches.values()).find(
			(b) => b.name === data.name,
		);

		if (existingBranch) {
			throw new Error(`Branch with name '${data.name}' already exists`);
		}

		const branch: Branch = {
			id: this.nextBranchId++,
			...data,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		storage.branches.set(branch.id, branch);
		return branch;
	}

	async deleteBranch(
		id: number,
		transactionID?: string | number,
	): Promise<Branch> {
		const storage = this.getStorage(transactionID);
		const branch = storage.branches.get(id);
		if (!branch) {
			throw new Error(`Branch with id ${id} not found`);
		}
		storage.branches.delete(id);
		return branch;
	}

	// Activity Module operations
	async findActivityModules(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<ActivityModule>> {
		const storage = this.getStorage(transactionID);
		let docs = Array.from(storage.activityModules.values());

		// Apply where filter
		if (options.where) {
			docs = this.applyWhereFilter(docs, options.where);
		}

		// Apply sort
		if (options.sort) {
			docs = this.applySort(docs, options.sort);
		}

		// Apply pagination
		const limit = options.limit || 10;
		const page = options.page || 1;
		const totalDocs = docs.length;
		const totalPages = Math.ceil(totalDocs / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		docs = docs.slice(startIndex, endIndex);

		return {
			docs,
			totalDocs,
			totalPages,
			page,
			limit,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
		};
	}

	async findActivityModuleById(
		id: number,
		transactionID?: string | number,
	): Promise<ActivityModule | null> {
		const storage = this.getStorage(transactionID);
		return storage.activityModules.get(id) || null;
	}

	async createActivityModule(
		data: CreateActivityModuleData,
		transactionID?: string | number,
	): Promise<ActivityModule> {
		const storage = this.getStorage(transactionID);

		// Enforce unique constraint: slug
		const existingModule = Array.from(storage.activityModules.values()).find(
			(m) => m.slug === data.slug,
		);

		if (existingModule) {
			throw new Error(
				`Activity module with slug '${data.slug}' already exists`,
			);
		}

		const activityModule: ActivityModule = {
			id: this.nextActivityModuleId++,
			...data,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		storage.activityModules.set(activityModule.id, activityModule);
		return activityModule;
	}

	async updateActivityModule(
		id: number,
		data: UpdateActivityModuleData,
		transactionID?: string | number,
	): Promise<ActivityModule> {
		const storage = this.getStorage(transactionID);
		const activityModule = storage.activityModules.get(id);
		if (!activityModule) {
			throw new Error(`Activity module with id ${id} not found`);
		}
		const updated = {
			...activityModule,
			...data,
			updatedAt: new Date().toISOString(),
		};
		storage.activityModules.set(id, updated);
		return updated;
	}

	async deleteActivityModule(
		id: number,
		transactionID?: string | number,
	): Promise<ActivityModule> {
		const storage = this.getStorage(transactionID);
		const activityModule = storage.activityModules.get(id);
		if (!activityModule) {
			throw new Error(`Activity module with id ${id} not found`);
		}
		storage.activityModules.delete(id);
		return activityModule;
	}

	// Commit operations
	async findCommits(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<Commit>> {
		const storage = this.getStorage(transactionID);
		let docs = Array.from(storage.commits.values());

		// Apply where filter
		if (options.where) {
			docs = this.applyWhereFilter(docs, options.where);
		}

		// Apply pagination
		const limit = options.limit || 10;
		const page = options.page || 1;
		const totalDocs = docs.length;
		const totalPages = Math.ceil(totalDocs / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		docs = docs.slice(startIndex, endIndex);

		return {
			docs,
			totalDocs,
			totalPages,
			page,
			limit,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
		};
	}

	async findCommitById(
		id: number,
		transactionID?: string | number,
	): Promise<Commit | null> {
		const storage = this.getStorage(transactionID);
		return storage.commits.get(id) || null;
	}

	async createCommit(
		data: CreateCommitData,
		transactionID?: string | number,
	): Promise<Commit> {
		const storage = this.getStorage(transactionID);

		// Enforce unique constraint: hash
		const existingCommit = Array.from(storage.commits.values()).find(
			(c) => c.hash === data.hash,
		);

		if (existingCommit) {
			throw new Error(`Commit with hash '${data.hash}' already exists`);
		}

		const commit: Commit = {
			id: this.nextCommitId++,
			...data,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		storage.commits.set(commit.id, commit);
		return commit;
	}

	// Activity Module Version operations
	async findActivityModuleVersions(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<ActivityModuleVersion>> {
		const storage = this.getStorage(transactionID);
		let docs = Array.from(storage.activityModuleVersions.values());

		// Apply where filter
		if (options.where) {
			docs = this.applyWhereFilter(docs, options.where);
		}

		// Apply pagination
		const limit = options.limit || 10;
		const page = options.page || 1;
		const totalDocs = docs.length;
		const totalPages = Math.ceil(totalDocs / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		docs = docs.slice(startIndex, endIndex);

		return {
			docs,
			totalDocs,
			totalPages,
			page,
			limit,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
		};
	}

	async createActivityModuleVersion(
		data: CreateActivityModuleVersionData,
		transactionID?: string | number,
	): Promise<ActivityModuleVersion> {
		const storage = this.getStorage(transactionID);

		// Enforce unique constraint: activityModule + commit + branch
		const existingVersion = Array.from(
			storage.activityModuleVersions.values(),
		).find(
			(v) =>
				v.activityModule === data.activityModule &&
				v.commit === data.commit &&
				v.branch === data.branch,
		);

		if (existingVersion) {
			throw new Error(
				`Activity module version with activityModule=${data.activityModule}, commit=${data.commit}, branch=${data.branch} already exists`,
			);
		}

		const version: ActivityModuleVersion = {
			id: this.nextActivityModuleVersionId++,
			...data,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		storage.activityModuleVersions.set(version.id, version);
		return version;
	}

	async updateActivityModuleVersion(
		id: number,
		data: Partial<CreateActivityModuleVersionData>,
		transactionID?: string | number,
	): Promise<ActivityModuleVersion> {
		const storage = this.getStorage(transactionID);
		const version = storage.activityModuleVersions.get(id);
		if (!version) {
			throw new Error(`Activity module version with id ${id} not found`);
		}
		const updated = {
			...version,
			...data,
			updatedAt: new Date().toISOString(),
		};
		storage.activityModuleVersions.set(id, updated);
		return updated;
	}

	async deleteActivityModuleVersion(
		id: number,
		transactionID?: string | number,
	): Promise<ActivityModuleVersion> {
		const storage = this.getStorage(transactionID);
		const version = storage.activityModuleVersions.get(id);
		if (!version) {
			throw new Error(`Activity module version with id ${id} not found`);
		}
		storage.activityModuleVersions.delete(id);
		return version;
	}

	// Commit Parent operations
	async createCommitParent(
		data: CreateCommitParentData,
		transactionID?: string | number,
	): Promise<CommitParent> {
		const storage = this.getStorage(transactionID);

		// Enforce unique constraint: commit + parentCommit
		const existingParent = Array.from(storage.commitParents.values()).find(
			(cp) =>
				cp.commit === data.commit && cp.parentCommit === data.parentCommit,
		);

		if (existingParent) {
			throw new Error(
				`Commit parent with commit=${data.commit} and parentCommit=${data.parentCommit} already exists`,
			);
		}

		const commitParent: CommitParent = {
			id: this.nextCommitParentId++,
			...data,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		storage.commitParents.set(commitParent.id, commitParent);
		return commitParent;
	}

	// Helper methods for filtering
	private applyWhereFilter<T>(docs: T[], where: Record<string, unknown>): T[] {
		return docs.filter((doc) => {
			for (const [key, condition] of Object.entries(where)) {
				if (key === "and" && Array.isArray(condition)) {
					// Handle AND conditions
					for (const andCondition of condition) {
						if (
							!this.matchesCondition(
								doc as Record<string, unknown>,
								andCondition,
							)
						) {
							return false;
						}
					}
				} else if (
					!this.matchesCondition(doc as Record<string, unknown>, {
						[key]: condition,
					})
				) {
					return false;
				}
			}
			return true;
		});
	}

	private matchesCondition(
		doc: Record<string, unknown>,
		condition: Record<string, unknown>,
	): boolean {
		for (const [field, value] of Object.entries(condition)) {
			const docValue = doc[field];

			if (typeof value === "object" && value !== null) {
				const operator = Object.keys(value)[0];
				const operand = (value as Record<string, unknown>)[operator];

				switch (operator) {
					case "equals":
						if (docValue !== operand) return false;
						break;
					case "contains":
						if (
							typeof docValue !== "string" ||
							!docValue.includes(operand as string)
						)
							return false;
						break;
					default:
						return false;
				}
			} else if (docValue !== value) {
				return false;
			}
		}
		return true;
	}

	private applySort<T>(docs: T[], sort: string): T[] {
		const isDescending = sort.startsWith("-");
		const field = isDescending ? sort.slice(1) : sort;

		return docs.sort((a, b) => {
			const aVal = (a as Record<string, unknown>)[field];
			const bVal = (b as Record<string, unknown>)[field];

			if (aVal === bVal) return 0;
			if (aVal === undefined || aVal === null) return 1;
			if (bVal === undefined || bVal === null) return -1;

			const comparison = aVal < bVal ? -1 : 1;
			return isDescending ? -comparison : comparison;
		});
	}
}
