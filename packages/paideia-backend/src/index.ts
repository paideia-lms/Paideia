export * from "./errors";
export { envVars } from "./env";
export { s3Client } from "./utils/s3-client";
export { asciiLogo, devConstants } from "./utils/constants";
export { isD2Available } from "./utils/cli-dependencies-check";
export { debugLog } from "./utils/debug";
export {
	getRequestInfo,
	type RequestInfo,
} from "./utils/get-request-info";

export * from "./internal/activity-module-access";
export * from "./internal/activity-module-management";
export * from "./internal/analytics-settings";
export * from "./internal/appearance-settings";
export * from "./internal/assignment-submission-management";
export * from "./internal/category-role-management";
export * from "./internal/course-activity-module-link-management";
export * from "./internal/course-category-management";
export * from "./internal/course-management";
export * from "./internal/course-section-management";
export * from "./internal/discussion-management";
export * from "./internal/email";
export * from "./internal/enrollment-management";
export * from "./internal/gradebook-category-management";
export * from "./internal/gradebook-item-management";
export * from "./internal/gradebook-management";
export * from "./internal/maintenance-settings";
export * from "./internal/media-management";
export * from "./internal/note-management";
export * from "./internal/quiz-module-management";
export * from "./internal/quiz-submission-management";
export * from "./internal/registration-settings";
export * from "./internal/scheduled-tasks-management";
export * from "./internal/cron-jobs-management";
export * from "./internal/search-management";
export * from "./internal/site-policies";
export * from "./internal/system-globals";
export * from "./internal/user-grade-management";
export * from "./internal/user-management";
export * from "./internal/version-management";

export { permissions } from "./utils/permissions";
export {
	handleTransactionId,
	commitTransactionIfCreated,
	rollbackTransactionIfCreated,
} from "./internal/utils/handle-transaction-id";
export { convertDatabaseAnswersToQuizAnswers } from "./internal/utils/quiz-answer-converter";
export {
	generateCourseStructureTree,
	generateSimpleCourseStructureTree,
} from "./utils/course-structure-tree";
export {
	createLocalReq,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./internal/utils/internal-function-utils";

export type { User, Course } from "./payload-types";
export type { ActivityModule } from "./payload-types";
export type { Media } from "./payload-types";
export type { Enrollment } from "./payload-types";
export { Users } from "./collections/users";

// Export from v2 excluding *Args types that conflict with quiz-module-management
export type {
	QuizResource,
	QuestionType,
	SimpleScoring,
	WeightedScoring,
	RubricScoring,
	ManualScoring,
	PartialMatchScoring,
	RankingScoring,
	MatrixScoring,
	ScoringConfig,
	BaseQuestion,
	MultipleChoiceQuestion,
	ShortAnswerQuestion,
	LongAnswerQuestion,
	ArticleQuestion,
	FillInTheBlankQuestion,
	ChoiceQuestion,
	RankingQuestion,
	SingleSelectionMatrixQuestion,
	MultipleSelectionMatrixQuestion,
	WhiteboardQuestion,
	Question,
	QuizPage,
	GradingConfig,
	NestedQuizConfig,
	RegularQuizConfig,
	ContainerQuizConfig,
	QuizConfig,
	QuestionAnswer,
	QuizAnswers,
	TypedQuestionAnswer,
} from "./json/raw-quiz-config/v2";
export {
	getQuestionPoints,
	getScoringDescription,
	calculateTotalPoints,
	getDefaultScoring,
	QuizConfigValidationError,
	QuizElementNotFoundError,
	toggleQuizType,
	updateGlobalTimer,
	updateNestedQuizTimer,
	updateGradingConfig,
	addQuizResource,
	removeQuizResource,
	updateQuizResource,
	addQuestion,
	removeQuestion,
	updateQuestion,
	updateMultipleChoiceQuestion,
	updateChoiceQuestion,
	updateShortAnswerQuestion,
	updateLongAnswerQuestion,
	updateFillInTheBlankQuestion,
	updateRankingQuestion,
	updateSingleSelectionMatrixQuestion,
	updateMultipleSelectionMatrixQuestion,
	addPage,
	removePage,
	addNestedQuiz,
	removeNestedQuiz,
	updateNestedQuizInfo,
	reorderNestedQuizzes,
	updateContainerSettings,
	updateQuizInfo,
	updatePageInfo,
	reorderPages,
	moveQuestionToPage,
	updateQuestionScoring,
	createDefaultQuizConfig,
} from "./json/raw-quiz-config/v2";
export * from "./json/course-module-settings/version-resolver";
export * from "./json/raw-quiz-config/version-resolver";
