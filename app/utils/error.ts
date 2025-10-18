export class ContextNotFoundError extends Error {
	static readonly type = "ContextNotFoundError";
	get type() {
		return ContextNotFoundError.type;
	}
}

export class UnauthorizedError extends Error {
	static readonly type = "UnauthorizedError";
	get type() {
		return UnauthorizedError.type;
	}
}

export class DuplicateBranchError extends Error {
	static readonly type = "DuplicateBranchError";
	get type() {
		return DuplicateBranchError.type;
	}
}

export class DuplicateActivityModuleError extends Error {
	static readonly type = "DuplicateActivityModuleError";
	get type() {
		return DuplicateActivityModuleError.type;
	}
}

export class InvalidArgumentError extends Error {
	static readonly type = "InvalidArgumentError";
	get type() {
		return InvalidArgumentError.type;
	}
}

export class NonExistingSourceError extends Error {
	static readonly type = "NonExistingSourceError";
	get type() {
		return NonExistingSourceError.type;
	}
}

export class TransactionIdNotFoundError extends Error {
	static readonly type = "TransactionIdNotFoundError";
	get type() {
		return TransactionIdNotFoundError.type;
	}
}

export class NonExistingActivityModuleError extends Error {
	static readonly type = "NonExistingActivityModuleError";
	get type() {
		return NonExistingActivityModuleError.type;
	}
}

export class CommitNoChangeError extends Error {
	static readonly type = "CommitNoChangeError";
	get type() {
		return CommitNoChangeError.type;
	}
}

export class UnknownError extends Error {
	static readonly type = "UnknownError";
	get type() {
		return UnknownError.type;
	}
}

export class EnrollmentNotFoundError extends Error {
	static readonly type = "EnrollmentNotFoundError";
	get type() {
		return EnrollmentNotFoundError.type;
	}
}

export class DuplicateEnrollmentError extends Error {
	static readonly type = "DuplicateEnrollmentError";
	get type() {
		return DuplicateEnrollmentError.type;
	}
}

export class NonExistingMergeRequestError extends Error {
	static readonly type = "NonExistingMergeRequestError";
	get type() {
		return NonExistingMergeRequestError.type;
	}
}

export class NonExistingMediaError extends Error {
	static readonly type = "NonExistingMediaError";
	get type() {
		return NonExistingMediaError.type;
	}
}

export class DevelopmentError extends Error {
	static readonly type = "DevelopmentError";
	get type() {
		return DevelopmentError.type;
	}
}

export class GradebookNotFoundError extends Error {
	static readonly type = "GradebookNotFoundError";
	get type() {
		return GradebookNotFoundError.type;
	}
}

export class GradebookCategoryNotFoundError extends Error {
	static readonly type = "GradebookCategoryNotFoundError";
	get type() {
		return GradebookCategoryNotFoundError.type;
	}
}

export class GradebookItemNotFoundError extends Error {
	static readonly type = "GradebookItemNotFoundError";
	get type() {
		return GradebookItemNotFoundError.type;
	}
}

export class UserGradeNotFoundError extends Error {
	static readonly type = "UserGradeNotFoundError";
	get type() {
		return UserGradeNotFoundError.type;
	}
}

export class DuplicateGradebookError extends Error {
	static readonly type = "DuplicateGradebookError";
	get type() {
		return DuplicateGradebookError.type;
	}
}

export class InvalidGradeValueError extends Error {
	static readonly type = "InvalidGradeValueError";
	get type() {
		return InvalidGradeValueError.type;
	}
}

export class InvalidSortOrderError extends Error {
	static readonly type = "InvalidSortOrderError";
	get type() {
		return InvalidSortOrderError.type;
	}
}

export class WeightExceedsLimitError extends Error {
	static readonly type = "WeightExceedsLimitError";
	get type() {
		return WeightExceedsLimitError.type;
	}
}

export class NonExistingAssignmentSubmissionError extends Error {
	static readonly type = "NonExistingAssignmentSubmissionError";
	get type() {
		return NonExistingAssignmentSubmissionError.type;
	}
}

export class NonExistingQuizSubmissionError extends Error {
	static readonly type = "NonExistingQuizSubmissionError";
	get type() {
		return NonExistingQuizSubmissionError.type;
	}
}

export class NonExistingDiscussionSubmissionError extends Error {
	static readonly type = "NonExistingDiscussionSubmissionError";
	get type() {
		return NonExistingDiscussionSubmissionError.type;
	}
}

export class ActivityModuleAccessDeniedError extends Error {
	static readonly type = "ActivityModuleAccessDeniedError";
	get type() {
		return ActivityModuleAccessDeniedError.type;
	}
}

export class DuplicateAccessGrantError extends Error {
	static readonly type = "DuplicateAccessGrantError";
	get type() {
		return DuplicateAccessGrantError.type;
	}
}

export class AccessGrantNotFoundError extends Error {
	static readonly type = "AccessGrantNotFoundError";
	get type() {
		return AccessGrantNotFoundError.type;
	}
}

export class InvalidOwnerTransferError extends Error {
	static readonly type = "InvalidOwnerTransferError";
	get type() {
		return InvalidOwnerTransferError.type;
	}
}

export class CourseAccessDeniedError extends Error {
	static readonly type = "CourseAccessDeniedError";
	get type() {
		return CourseAccessDeniedError.type;
	}
}

export class CourseStructureNotFoundError extends Error {
	static readonly type = "CourseStructureNotFoundError";
	get type() {
		return CourseStructureNotFoundError.type;
	}
}



export function transformError(error: unknown) {
	if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
		console.log("transformError", error);
	}
	if (error instanceof NonExistingSourceError) return error;
	else if (error instanceof DuplicateBranchError) return error;
	else if (error instanceof UnauthorizedError) return error;
	else if (error instanceof ContextNotFoundError) return error;
	else if (error instanceof InvalidArgumentError) return error;
	else if (error instanceof TransactionIdNotFoundError) return error;
	else if (error instanceof NonExistingActivityModuleError) return error;
	else if (error instanceof CommitNoChangeError) return error;
	else if (error instanceof EnrollmentNotFoundError) return error;
	else if (error instanceof DuplicateEnrollmentError) return error;
	else if (error instanceof NonExistingMergeRequestError) return error;
	else if (error instanceof NonExistingMediaError) return error;
	else if (error instanceof GradebookNotFoundError) return error;
	else if (error instanceof GradebookCategoryNotFoundError) return error;
	else if (error instanceof GradebookItemNotFoundError) return error;
	else if (error instanceof UserGradeNotFoundError) return error;
	else if (error instanceof DuplicateGradebookError) return error;
	else if (error instanceof InvalidGradeValueError) return error;
	else if (error instanceof InvalidSortOrderError) return error;
	else if (error instanceof WeightExceedsLimitError) return error;
	else if (error instanceof NonExistingAssignmentSubmissionError) return error;
	else if (error instanceof NonExistingQuizSubmissionError) return error;
	else if (error instanceof NonExistingDiscussionSubmissionError) return error;
	else if (error instanceof ActivityModuleAccessDeniedError) return error;
	else if (error instanceof DuplicateAccessGrantError) return error;
	else if (error instanceof AccessGrantNotFoundError) return error;
	else if (error instanceof InvalidOwnerTransferError) return error;
	else if (error instanceof CourseAccessDeniedError) return error;
	else if (error instanceof CourseStructureNotFoundError) return error;
	// ! we let user handle the unknown error
	else return undefined;
}
