export {
	Paideia,
	type Payload,
	type Migration,
	type SanitizedConfig,
	type RequestContext,
	type CreateRequestContextArgs,
} from "./paideia";
export * from "./errors";
export { envVars } from "./modules/infrastructure/services/env";
export { s3Client } from "./modules/infrastructure/services/s3-client";
export { asciiLogo, devConstants } from "./utils/constants";
export { isD2Available } from "./utils/cli-dependencies-check";
export { debugLog } from "./utils/debug";
export {
	getRequestInfo,
	type RequestInfo,
} from "./utils/get-request-info";
export {
	setAuthCookie,
	removeAuthCookie,
	setImpersonationCookie,
	removeImpersonationCookie,
	type CookieOptions,
} from "./utils/cookie";

export { tryCreateUser } from "./modules/user/services/user-management";
export type { CategoryTreeNode, FlatNode } from "./internal/course-category-management";
export { flattenCategories } from "./internal/course-category-management";
export const USER_ROLES = [
	"admin",
	"content-manager",
	"analytics-viewer",
	"instructor",
	"student",
] as const;
export type UserRole = (typeof USER_ROLES)[number];
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
	flattenGradebookCategories,
	type FlattenedCategory,
} from "./utils/flatten-gradebook-categories";
export {
	createLocalReq,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./internal/utils/internal-function-utils";

export type {
	SingleUserGradesJsonRepresentation,
	UserGradeEnrollment,
	UserGradeItem,
} from "./internal/user-grade-management";
export type { User, Course } from "./payload-types";
export type { ActivityModule } from "./payload-types";
export type { ActivityModuleResult } from "./internal/activity-module-management";
export type { Media } from "./payload-types";
export type { Enrollment } from "./payload-types";
export { Users } from "./modules/user/collections/users";

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

// Server / payload exports (consolidated from server.ts and payload-exports.ts)
export {
	createOpenApiGenerator,
	createOpenApiHandler,
	createScalarDocsHtml,
} from "./orpc/openapi-handler";
export { orpcRouter } from "./orpc/router";
export { generateCookie, parseCookies, executeAuthStrategies } from "payload";
export type { PayloadRequest, BasePayload } from "payload";
export { getMigrationStatus } from "./modules/infrastructure/services/migration-status";
export { dumpDatabase } from "./modules/infrastructure/services/dump";
export { migrations } from "./migrations";
export { tryRunSeed } from "./utils/db/seed";
export { tryResetSandbox } from "./modules/infrastructure/services/sandbox-reset";
export { displayHelp } from "./cli/commands";
export {
	detectSystemResources,
	getServerTimezone,
} from "./modules/infrastructure/services/bun-system-resources";
