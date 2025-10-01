import type {
	ActivityModule,
	ActivityModuleVersion,
	Branch,
	Commit,
	CommitParent,
} from "../payload-types";

/**
 * Storage interface for activity module operations
 * This abstraction allows for different storage implementations (in-memory, PostgreSQL, etc.)
 */

export interface FindOptions {
	where?: Record<string, unknown>;
	limit?: number;
	page?: number;
	sort?: string;
	populate?: Record<string, unknown>;
}

export interface FindResult<T> {
	docs: T[];
	totalDocs: number;
	totalPages: number;
	page: number;
	limit: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface CreateActivityModuleData {
	slug: string;
	title: string;
	description?: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status: "draft" | "published" | "archived";
	createdBy: number;
}

export interface UpdateActivityModuleData {
	title?: string;
	description?: string;
	status?: "draft" | "published" | "archived";
}

export interface CreateBranchData {
	name: string;
	description: string;
	isDefault: boolean;
	createdBy: number;
}

export interface CreateCommitData {
	hash: string;
	message: string;
	author: number;
	committer: number;
	parentCommit?: number | null;
	isMergeCommit: boolean;
	commitDate: string;
}

export interface CreateActivityModuleVersionData {
	activityModule: number;
	commit: number;
	branch: number;
	content: Record<string, unknown>;
	title: string;
	description?: string;
	isCurrentHead: boolean;
	contentHash: string;
}

export interface CreateCommitParentData {
	commit: number;
	parentCommit: number;
	parentOrder: number;
}

/**
 * Activity module storage interface
 * Implementations should handle transactions internally
 */
export interface IActivityModuleStorage {
	// Transaction management
	beginTransaction(): Promise<string | number>;
	commitTransaction(transactionID: string | number): Promise<void>;
	rollbackTransaction(transactionID: string | number): Promise<void>;

	// Branch operations
	findBranches(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<Branch>>;
	createBranch(
		data: CreateBranchData,
		transactionID?: string | number,
	): Promise<Branch>;
	deleteBranch(id: number, transactionID?: string | number): Promise<Branch>;

	// Activity Module operations
	findActivityModules(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<ActivityModule>>;
	findActivityModuleById(
		id: number,
		transactionID?: string | number,
	): Promise<ActivityModule | null>;
	createActivityModule(
		data: CreateActivityModuleData,
		transactionID?: string | number,
	): Promise<ActivityModule>;
	updateActivityModule(
		id: number,
		data: UpdateActivityModuleData,
		transactionID?: string | number,
	): Promise<ActivityModule>;
	deleteActivityModule(
		id: number,
		transactionID?: string | number,
	): Promise<ActivityModule>;

	// Commit operations
	findCommits(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<Commit>>;
	findCommitById(
		id: number,
		transactionID?: string | number,
	): Promise<Commit | null>;
	createCommit(
		data: CreateCommitData,
		transactionID?: string | number,
	): Promise<Commit>;

	// Activity Module Version operations
	findActivityModuleVersions(
		options: FindOptions,
		transactionID?: string | number,
	): Promise<FindResult<ActivityModuleVersion>>;
	createActivityModuleVersion(
		data: CreateActivityModuleVersionData,
		transactionID?: string | number,
	): Promise<ActivityModuleVersion>;
	updateActivityModuleVersion(
		id: number,
		data: Partial<CreateActivityModuleVersionData>,
		transactionID?: string | number,
	): Promise<ActivityModuleVersion>;
	deleteActivityModuleVersion(
		id: number,
		transactionID?: string | number,
	): Promise<ActivityModuleVersion>;

	// Commit Parent operations
	createCommitParent(
		data: CreateCommitParentData,
		transactionID?: string | number,
	): Promise<CommitParent>;
}
