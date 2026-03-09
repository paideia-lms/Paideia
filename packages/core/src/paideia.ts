import type { Migration, Payload } from "payload";
import type { Where } from "payload";
import { executeAuthStrategies, generateCookie, getPayload, parseCookies } from "payload";
import {
	createOpenApiGenerator,
	createOpenApiHandler,
	createScalarDocsHtml,
} from "./orpc/openapi-handler";
import { orpcRouter } from "./orpc/router";
import sanitizedConfig from "./payload.config";
import { testConnections } from "./modules/infrastructure/services/health-check";
import { migrations } from "./migrations";
import { validateEnvVars } from "./modules/infrastructure/services/env";
import { createLocalReq } from "@paideia/shared";
import {
	commitTransactionIfCreated as commitTransactionIfCreatedFn,
	handleTransactionId,
	rollbackTransactionIfCreated as rollbackTransactionIfCreatedFn,
} from "@paideia/shared";
import { permissions } from "./utils/permissions";
import * as activityModuleAccess from "./internal/activity-module-access";
import * as activityModuleManagement from "./internal/activity-module-management";
import * as analyticsSettings from "./internal/analytics-settings";
import * as appearanceSettings from "./internal/appearance-settings";
import * as assignmentSubmissionManagement from "./internal/assignment-submission-management";
import * as categoryRoleManagement from "./internal/category-role-management";
import * as courseActivityModuleLinkManagement from "./modules/courses/services/course-activity-module-link-management";
import * as courseCategoryManagement from "./internal/course-category-management";
import * as courseManagement from "./modules/courses/services/course-management";
import * as CreateGroupArgs from "./modules/enrolment/services/group-management";
import * as courseSectionManagement from "./modules/courses/services/course-section-management";
import * as discussionManagement from "./internal/discussion-management";
import * as email from "modules/infrastructure/services/email";
import * as enrollmentManagement from "./modules/enrolment/services/enrollment-management";
import * as gradebookCategoryManagement from "./internal/gradebook-category-management";
import * as gradebookItemManagement from "./internal/gradebook-item-management";
import * as gradebookManagement from "./internal/gradebook-management";
import * as maintenanceSettings from "./internal/maintenance-settings";
import * as mediaManagement from "./modules/user/services/media-management";
import * as noteManagement from "./modules/note/services/note-management";
import * as quizModuleManagement from "./internal/quiz-module-management";
import * as quizSubmissionManagement from "./internal/quiz-submission-management";
import * as registrationSettings from "./internal/registration-settings";
import * as scheduledTasksManagement from "./internal/scheduled-tasks-management";
import * as cronJobsManagement from "./modules/infrastructure/services/cron-jobs-management";
import * as searchManagement from "./internal/search-management";
import * as sitePolicies from "./internal/site-policies";
import * as systemGlobals from "./internal/system-globals";
import * as userGradeManagement from "./internal/user-grade-management";
import * as userManagement from "./modules/user/services/user-management";
import * as versionManagement from "./modules/infrastructure/services/version-management";
import { s3Client } from "./modules/infrastructure/services/s3-client";
import { tryResolveCourseModuleSettingsToLatest } from "./json/course-module-settings/version-resolver";
import { getMigrationStatus } from "./modules/infrastructure/services/migration-status";
import { dumpDatabase } from "./modules/infrastructure/services/dump";
import { tryResetSandbox as tryResetSandboxFn } from "./modules/infrastructure/services/sandbox-reset";
// const { createCli } = await import("trpc-cli");
// 		const { createCliRouter } = await import("./cli/commands");
// 		const packageJson = await import("../package.json");
import { createCli } from "trpc-cli";
import { createCliRouter } from "./cli/commands";
import type { PackageJson } from "type-fest";

export type { Payload, Migration };

export { migrations };

export type SanitizedConfig = typeof sanitizedConfig;

export type RequestContext = ReturnType<typeof createLocalReq>;

export type CreateRequestContextArgs = Parameters<typeof createLocalReq>[0];

/**
 * Paideia backend - encapsulates Payload CMS instance, config, migrations, and CLI.
 * All backend operations are exposed as class methods; the class holds the payload internally.
 */
export class Paideia {
	private payload: Payload | null = null;
	private config = sanitizedConfig;

	constructor() {
		validateEnvVars();
	}

	async init(): Promise<Payload> {
		if (this.payload) {
			return this.payload;
		}
		this.payload = await getPayload({
			config: this.config,
			cron: true,
			key: "paideia",
		});
		await testConnections(this.payload);
		return this.payload;
	}

	getPayload(): Payload {
		if (!this.payload) {
			throw new Error(
				"Paideia not initialized. Call init() before getPayload().",
			);
		}
		return this.payload;
	}

	getConfig(): SanitizedConfig {
		return this.config;
	}

	// getMigrations(): typeof migrations {
	// 	return migrations;
	// }

	async getMigrationStatus() {
		return getMigrationStatus({
			payload: this.getPayload(),
			migrations: migrations as Migration[],
		});
	}

	async dumpDatabase(opts?: { outputPath?: string }) {
		return dumpDatabase({
			payload: this.getPayload(),
			outputPath: opts?.outputPath,
		});
	}

	async migrate() {
		await this.getPayload().db.migrate({
			migrations: migrations as Migration[],
		});
	}

	// tryResetSandbox(opts?: { vfs?: Record<string, string> }) {
	// 	return tryResetSandboxFn({
	// 		payload: this.getPayload(),
	// 		req: undefined,
	// 		overrideAccess: true,
	// 		vfs: opts?.vfs ?? {},
	// 	});
	// }

	async createCli({ name, version, description, packageJson }: { name: string, version: string, description: string, packageJson: PackageJson }) {

		return createCli({
			router: createCliRouter(),
			context: { payload: this.getPayload(), packageJson: packageJson },
			name,
			version,
			description,
		});
	}

	getOpenApiHandler() {
		return createOpenApiHandler(orpcRouter, this.getPayload());
	}

	async handleOpenApiRequest(request: Request): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		const baseUrl = `${new URL(request.url).origin}/openapi`;

		if (pathname === "/openapi/spec.json") {
			const openApiGenerator = createOpenApiGenerator();
			const spec = await openApiGenerator.generate(orpcRouter, {
				info: { title: "Paideia LMS API", version: "1.0.0" },
				servers: [{ url: baseUrl }],
			});
			return new Response(JSON.stringify(spec), {
				headers: { "Content-Type": "application/json" },
			});
		}
		if (pathname === "/openapi" || pathname === "/openapi/") {
			return new Response(createScalarDocsHtml(`${baseUrl}/spec.json`), {
				headers: { "Content-Type": "text/html" },
			});
		}
		const { user } = await this.executeAuthStrategies({
			headers: request.headers,
			canSetHeaders: false,
		});
		const orpcHandler = this.getOpenApiHandler();
		const { matched, response } = await orpcHandler.handle(request, {
			prefix: "/openapi",
			context: {
				payload: this.getPayload(),
				s3Client,
				user: user ?? null,
				req: user ? { user } : undefined,
			},
		});
		return matched ? response : new Response("Not Found", { status: 404 });
	}

	// --- Request context & auth ---

	createRequestContext(args: CreateRequestContextArgs): RequestContext {
		return createLocalReq(args);
	}

	executeAuthStrategies(opts: {
		headers: Headers;
		canSetHeaders: boolean;
	}) {
		return executeAuthStrategies({
			...opts,
			payload: this.getPayload(),
		});
	}

	parseCookies(headers: Headers) {
		return parseCookies(headers);
	}

	generateCookie(opts: Parameters<typeof generateCookie>[0]) {
		return generateCookie(opts);
	}

	getCookiePrefix(): string {
		return this.getPayload().config.cookiePrefix;
	}

	getLogger() {
		return this.getPayload().logger;
	}

	async handleTransactionId(req?: RequestContext) {
		return handleTransactionId(this.getPayload(), req);
	}

	async commitTransactionIfCreated(
		transactionInfo: Awaited<ReturnType<typeof handleTransactionId>>,
	) {
		return commitTransactionIfCreatedFn(this.getPayload(), transactionInfo);
	}

	async rollbackTransactionIfCreated(
		transactionInfo: Awaited<ReturnType<typeof handleTransactionId>>,
	) {
		return rollbackTransactionIfCreatedFn(this.getPayload(), transactionInfo);
	}

	get permissions() {
		return permissions;
	}

	async count(args: {
		collection: keyof Payload["collections"];
		where?: Where;
		req?: RequestContext;
		overrideAccess?: boolean;
	}) {
		return this.getPayload().count({
			collection: args.collection,
			where: args.where,
			req: args.req,
			overrideAccess: args.overrideAccess,
		});
	}

	async update(args: {
		collection: keyof Payload["collections"];
		id: number;
		data: Record<string, unknown>;
		req?: RequestContext;
	}) {
		return this.getPayload().update({
			collection: args.collection,
			id: args.id,
			data: args.data,
			req: args.req,
		});
	}

	// --- Internal helpers ---

	private withPayload<T extends { payload?: Payload; req?: RequestContext }>(
		args: Omit<T, "payload">,
	) {
		return { ...args, payload: this.getPayload() } as T;
	}

	// --- Activity module access ---

	tryGrantAccessToActivityModule(
		args: Omit<
			Parameters<typeof activityModuleAccess.tryGrantAccessToActivityModule>[0],
			"payload"
		>,
	) {
		return activityModuleAccess.tryGrantAccessToActivityModule(
			this.withPayload(args),
		);
	}

	tryRevokeAccessFromActivityModule(
		args: Omit<
			Parameters<typeof activityModuleAccess.tryRevokeAccessFromActivityModule>[0],
			"payload"
		>,
	) {
		return activityModuleAccess.tryRevokeAccessFromActivityModule(
			this.withPayload(args),
		);
	}

	tryFindGrantsByActivityModule(
		args: Omit<
			Parameters<typeof activityModuleAccess.tryFindGrantsByActivityModule>[0],
			"payload"
		>,
	) {
		return activityModuleAccess.tryFindGrantsByActivityModule(
			this.withPayload(args),
		);
	}

	tryFindInstructorsForActivityModule(
		args: Omit<
			Parameters<
				typeof activityModuleAccess.tryFindInstructorsForActivityModule
			>[0],
			"payload"
		>,
	) {
		return activityModuleAccess.tryFindInstructorsForActivityModule(
			this.withPayload(args),
		);
	}

	tryFindAutoGrantedModulesForInstructor(
		args: Omit<
			Parameters<
				typeof activityModuleAccess.tryFindAutoGrantedModulesForInstructor
			>[0],
			"payload"
		>,
	) {
		return activityModuleAccess.tryFindAutoGrantedModulesForInstructor(
			this.withPayload(args),
		);
	}

	// --- Activity module management ---

	tryGetActivityModuleById(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryGetActivityModuleById>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryGetActivityModuleById(
			this.withPayload(args),
		);
	}

	tryDeleteActivityModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryDeleteActivityModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryDeleteActivityModule(
			this.withPayload(args),
		);
	}

	tryGetUserActivityModules(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryGetUserActivityModules>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryGetUserActivityModules(
			this.withPayload(args),
		);
	}

	tryCreatePageModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryCreatePageModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryCreatePageModule(
			this.withPayload(args),
		);
	}

	tryCreateWhiteboardModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryCreateWhiteboardModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryCreateWhiteboardModule(
			this.withPayload(args),
		);
	}

	tryCreateFileModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryCreateFileModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryCreateFileModule(
			this.withPayload(args),
		);
	}

	tryCreateAssignmentModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryCreateAssignmentModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryCreateAssignmentModule(
			this.withPayload(args),
		);
	}

	tryCreateQuizModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryCreateQuizModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryCreateQuizModule(
			this.withPayload(args),
		);
	}

	tryCreateDiscussionModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryCreateDiscussionModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryCreateDiscussionModule(
			this.withPayload(args),
		);
	}

	tryUpdatePageModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryUpdatePageModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryUpdatePageModule(
			this.withPayload(args),
		);
	}

	tryUpdateWhiteboardModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryUpdateWhiteboardModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryUpdateWhiteboardModule(
			this.withPayload(args),
		);
	}

	tryUpdateFileModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryUpdateFileModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryUpdateFileModule(
			this.withPayload(args),
		);
	}

	tryUpdateAssignmentModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryUpdateAssignmentModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryUpdateAssignmentModule(
			this.withPayload(args),
		);
	}

	tryUpdateQuizModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryUpdateQuizModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryUpdateQuizModule(
			this.withPayload(args),
		);
	}

	tryUpdateDiscussionModule(
		args: Omit<
			Parameters<typeof activityModuleManagement.tryUpdateDiscussionModule>[0],
			"payload"
		>,
	) {
		return activityModuleManagement.tryUpdateDiscussionModule(
			this.withPayload(args),
		);
	}

	// --- Quiz module management ---

	tryToggleQuizType(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryToggleQuizType>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryToggleQuizType(this.withPayload(args));
	}

	tryUpdateGlobalTimer(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateGlobalTimer>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateGlobalTimer(
			this.withPayload(args),
		);
	}

	tryUpdateNestedQuizTimer(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateNestedQuizTimer>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateNestedQuizTimer(
			this.withPayload(args),
		);
	}

	tryUpdateGradingConfig(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateGradingConfig>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateGradingConfig(
			this.withPayload(args),
		);
	}

	tryAddQuizResource(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryAddQuizResource>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryAddQuizResource(this.withPayload(args));
	}

	tryRemoveQuizResource(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryRemoveQuizResource>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryRemoveQuizResource(
			this.withPayload(args),
		);
	}

	tryUpdateQuizResource(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateQuizResource>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateQuizResource(
			this.withPayload(args),
		);
	}

	tryAddQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryAddQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryAddQuestion(this.withPayload(args));
	}

	tryRemoveQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryRemoveQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryRemoveQuestion(this.withPayload(args));
	}

	tryUpdateQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateQuestion(this.withPayload(args));
	}

	tryAddPage(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryAddPage>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryAddPage(this.withPayload(args));
	}

	tryRemovePage(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryRemovePage>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryRemovePage(this.withPayload(args));
	}

	tryAddNestedQuiz(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryAddNestedQuiz>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryAddNestedQuiz(this.withPayload(args));
	}

	tryRemoveNestedQuiz(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryRemoveNestedQuiz>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryRemoveNestedQuiz(
			this.withPayload(args),
		);
	}

	tryUpdateNestedQuizInfo(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateNestedQuizInfo>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateNestedQuizInfo(
			this.withPayload(args),
		);
	}

	tryReorderNestedQuizzes(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryReorderNestedQuizzes>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryReorderNestedQuizzes(
			this.withPayload(args),
		);
	}

	tryUpdateContainerSettings(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateContainerSettings>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateContainerSettings(
			this.withPayload(args),
		);
	}

	tryUpdateQuizInfo(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateQuizInfo>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateQuizInfo(this.withPayload(args));
	}

	tryUpdatePageInfo(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdatePageInfo>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdatePageInfo(this.withPayload(args));
	}

	tryReorderPages(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryReorderPages>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryReorderPages(this.withPayload(args));
	}

	tryMoveQuestionToPage(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryMoveQuestionToPage>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryMoveQuestionToPage(
			this.withPayload(args),
		);
	}

	tryUpdateQuestionScoring(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateQuestionScoring>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateQuestionScoring(
			this.withPayload(args),
		);
	}

	tryUpdateMultipleChoiceQuestion(
		args: Omit<
			Parameters<
				typeof quizModuleManagement.tryUpdateMultipleChoiceQuestion
			>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateMultipleChoiceQuestion(
			this.withPayload(args),
		);
	}

	tryUpdateChoiceQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateChoiceQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateChoiceQuestion(
			this.withPayload(args),
		);
	}

	tryUpdateShortAnswerQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateShortAnswerQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateShortAnswerQuestion(
			this.withPayload(args),
		);
	}

	tryUpdateLongAnswerQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateLongAnswerQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateLongAnswerQuestion(
			this.withPayload(args),
		);
	}

	tryUpdateFillInTheBlankQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateFillInTheBlankQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateFillInTheBlankQuestion(
			this.withPayload(args),
		);
	}

	tryUpdateRankingQuestion(
		args: Omit<
			Parameters<typeof quizModuleManagement.tryUpdateRankingQuestion>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateRankingQuestion(
			this.withPayload(args),
		);
	}

	tryUpdateSingleSelectionMatrixQuestion(
		args: Omit<
			Parameters<
				typeof quizModuleManagement.tryUpdateSingleSelectionMatrixQuestion
			>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateSingleSelectionMatrixQuestion(
			this.withPayload(args),
		);
	}

	tryUpdateMultipleSelectionMatrixQuestion(
		args: Omit<
			Parameters<
				typeof quizModuleManagement.tryUpdateMultipleSelectionMatrixQuestion
			>[0],
			"payload"
		>,
	) {
		return quizModuleManagement.tryUpdateMultipleSelectionMatrixQuestion(
			this.withPayload(args),
		);
	}

	// --- Analytics settings ---

	tryGetAnalyticsSettings(
		args: Omit<
			Parameters<typeof analyticsSettings.tryGetAnalyticsSettings>[0],
			"payload"
		>,
	) {
		return analyticsSettings.tryGetAnalyticsSettings(this.withPayload(args));
	}

	tryUpdateAnalyticsSettings(
		args: Omit<
			Parameters<typeof analyticsSettings.tryUpdateAnalyticsSettings>[0],
			"payload"
		>,
	) {
		return analyticsSettings.tryUpdateAnalyticsSettings(
			this.withPayload(args),
		);
	}

	// --- Appearance settings ---

	tryGetAppearanceSettings(
		args: Omit<
			Parameters<typeof appearanceSettings.tryGetAppearanceSettings>[0],
			"payload"
		>,
	) {
		return appearanceSettings.tryGetAppearanceSettings(
			this.withPayload(args),
		);
	}

	tryUpdateAppearanceSettings(
		args: Omit<
			Parameters<typeof appearanceSettings.tryUpdateAppearanceSettings>[0],
			"payload"
		>,
	) {
		return appearanceSettings.tryUpdateAppearanceSettings(
			this.withPayload(args),
		);
	}

	tryClearLogo(
		args: Omit<
			Parameters<typeof appearanceSettings.tryClearLogo>[0],
			"payload"
		>,
	) {
		return appearanceSettings.tryClearLogo(this.withPayload(args));
	}

	// --- Assignment submission management ---

	tryCreateAssignmentSubmission(
		args: Omit<
			Parameters<
				typeof assignmentSubmissionManagement.tryCreateAssignmentSubmission
			>[0],
			"payload"
		>,
	) {
		return assignmentSubmissionManagement.tryCreateAssignmentSubmission(
			this.withPayload(args),
		);
	}

	tryGetAssignmentSubmissionById(
		args: Omit<
			Parameters<
				typeof assignmentSubmissionManagement.tryGetAssignmentSubmissionById
			>[0],
			"payload"
		>,
	) {
		return assignmentSubmissionManagement.tryGetAssignmentSubmissionById(
			this.withPayload(args),
		);
	}

	tryGradeAssignmentSubmission(
		args: Omit<
			Parameters<
				typeof assignmentSubmissionManagement.tryGradeAssignmentSubmission
			>[0],
			"payload"
		>,
	) {
		return assignmentSubmissionManagement.tryGradeAssignmentSubmission(
			this.withPayload(args),
		);
	}

	tryRemoveAssignmentSubmissionGrade(
		args: Omit<
			Parameters<
				typeof assignmentSubmissionManagement.tryRemoveAssignmentSubmissionGrade
			>[0],
			"payload"
		>,
	) {
		return assignmentSubmissionManagement.tryRemoveAssignmentSubmissionGrade(
			this.withPayload(args),
		);
	}

	tryListAssignmentSubmissions(
		args: Omit<
			Parameters<
				typeof assignmentSubmissionManagement.tryListAssignmentSubmissions
			>[0],
			"payload"
		>,
	) {
		return assignmentSubmissionManagement.tryListAssignmentSubmissions(
			this.withPayload(args),
		);
	}

	tryDeleteAssignmentSubmission(
		args: Omit<
			Parameters<
				typeof assignmentSubmissionManagement.tryDeleteAssignmentSubmission
			>[0],
			"payload"
		>,
	) {
		return assignmentSubmissionManagement.tryDeleteAssignmentSubmission(
			this.withPayload(args),
		);
	}

	// --- Category role management ---

	tryGetCategoryRoleAssignments(
		args: Omit<
			Parameters<
				typeof categoryRoleManagement.tryGetCategoryRoleAssignments
			>[0],
			"payload"
		>,
	) {
		return categoryRoleManagement.tryGetCategoryRoleAssignments(
			this.withPayload(args),
		);
	}

	tryUpdateCategoryRole(
		args: Omit<
			Parameters<typeof categoryRoleManagement.tryUpdateCategoryRole>[0],
			"payload"
		>,
	) {
		return categoryRoleManagement.tryUpdateCategoryRole(
			this.withPayload(args),
		);
	}

	// --- Course activity module link management ---

	tryCreateCourseActivityModuleLink(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryCreateCourseActivityModuleLink
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryCreateCourseActivityModuleLink(
			this.withPayload(args),
		);
	}

	tryFindLinksByCourse(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryFindLinksByCourse
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryFindLinksByCourse(
			this.withPayload(args),
		);
	}

	tryFindLinksByActivityModule(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryFindLinksByActivityModule
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryFindLinksByActivityModule(
			this.withPayload(args),
		);
	}

	tryFindCourseActivityModuleLinkById(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryFindCourseActivityModuleLinkById
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryFindCourseActivityModuleLinkById(
			this.withPayload(args),
		);
	}

	tryDeleteCourseActivityModuleLink(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryDeleteCourseActivityModuleLink
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryDeleteCourseActivityModuleLink(
			this.withPayload(args),
		);
	}

	tryUpdatePageModuleSettings(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryUpdatePageModuleSettings
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryUpdatePageModuleSettings(
			this.withPayload(args),
		);
	}

	tryUpdateWhiteboardModuleSettings(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryUpdateWhiteboardModuleSettings
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryUpdateWhiteboardModuleSettings(
			this.withPayload(args),
		);
	}

	tryUpdateFileModuleSettings(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryUpdateFileModuleSettings
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryUpdateFileModuleSettings(
			this.withPayload(args),
		);
	}

	tryUpdateAssignmentModuleSettings(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryUpdateAssignmentModuleSettings
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryUpdateAssignmentModuleSettings(
			this.withPayload(args),
		);
	}

	tryUpdateQuizModuleSettings(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryUpdateQuizModuleSettings
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryUpdateQuizModuleSettings(
			this.withPayload(args),
		);
	}

	tryUpdateDiscussionModuleSettings(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryUpdateDiscussionModuleSettings
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryUpdateDiscussionModuleSettings(
			this.withPayload(args),
		);
	}

	tryGetCourseModuleSettings(
		args: Omit<
			Parameters<
				typeof courseActivityModuleLinkManagement.tryGetCourseModuleSettings
			>[0],
			"payload"
		>,
	) {
		return courseActivityModuleLinkManagement.tryGetCourseModuleSettings(
			this.withPayload(args),
		);
	}

	tryResolveCourseModuleSettingsToLatest(
		args: Parameters<typeof tryResolveCourseModuleSettingsToLatest>[0],
	) {
		return tryResolveCourseModuleSettingsToLatest(args);
	}

	// --- Course category management ---

	tryCreateCategory(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryCreateCategory>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryCreateCategory(
			this.withPayload(args),
		);
	}

	tryFindAllCategories(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryFindAllCategories>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryFindAllCategories(
			this.withPayload(args),
		);
	}

	tryDeleteCategory(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryDeleteCategory>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryDeleteCategory(
			this.withPayload(args),
		);
	}

	tryFindCategoryById(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryFindCategoryById>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryFindCategoryById(
			this.withPayload(args),
		);
	}

	tryFindSubcategories(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryFindSubcategories>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryFindSubcategories(
			this.withPayload(args),
		);
	}

	tryGetCategoryAncestors(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryGetCategoryAncestors>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryGetCategoryAncestors(
			this.withPayload(args),
		);
	}

	tryGetCategoryTree(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryGetCategoryTree>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryGetCategoryTree(
			this.withPayload(args),
		);
	}

	tryGetTotalNestedCoursesCount(
		args: Omit<
			Parameters<
				typeof courseCategoryManagement.tryGetTotalNestedCoursesCount
			>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryGetTotalNestedCoursesCount(
			this.withPayload(args),
		);
	}

	tryUpdateCategory(
		args: Omit<
			Parameters<typeof courseCategoryManagement.tryUpdateCategory>[0],
			"payload"
		>,
	) {
		return courseCategoryManagement.tryUpdateCategory(
			this.withPayload(args),
		);
	}

	// --- Course management ---

	tryCreateCourse(
		args: Omit<
			Parameters<typeof courseManagement.tryCreateCourse>[0],
			"payload"
		>,
	) {
		return courseManagement.tryCreateCourse(this.withPayload(args));
	}

	tryUpdateCourse(
		args: Omit<
			Parameters<typeof courseManagement.tryUpdateCourse>[0],
			"payload"
		>,
	) {
		return courseManagement.tryUpdateCourse(this.withPayload(args));
	}

	tryAddRecurringSchedule(
		args: Omit<
			Parameters<typeof courseManagement.tryAddRecurringSchedule>[0],
			"payload"
		>,
	) {
		return courseManagement.tryAddRecurringSchedule(this.withPayload(args));
	}

	tryAddSpecificDate(
		args: Omit<
			Parameters<typeof courseManagement.tryAddSpecificDate>[0],
			"payload"
		>,
	) {
		return courseManagement.tryAddSpecificDate(this.withPayload(args));
	}

	tryRemoveRecurringSchedule(
		args: Omit<
			Parameters<typeof courseManagement.tryRemoveRecurringSchedule>[0],
			"payload"
		>,
	) {
		return courseManagement.tryRemoveRecurringSchedule(this.withPayload(args));
	}

	tryRemoveSpecificDate(
		args: Omit<
			Parameters<typeof courseManagement.tryRemoveSpecificDate>[0],
			"payload"
		>,
	) {
		return courseManagement.tryRemoveSpecificDate(this.withPayload(args));
	}

	tryFindCourseById(
		args: Omit<
			Parameters<typeof courseManagement.tryFindCourseById>[0],
			"payload"
		>,
	) {
		return courseManagement.tryFindCourseById(this.withPayload(args));
	}

	tryFindAllCourses(
		args: Omit<
			Parameters<typeof courseManagement.tryFindAllCourses>[0],
			"payload"
		>,
	) {
		return courseManagement.tryFindAllCourses(this.withPayload(args));
	}

	tryDeleteCourse(
		args: Omit<
			Parameters<typeof courseManagement.tryDeleteCourse>[0],
			"payload"
		>,
	) {
		return courseManagement.tryDeleteCourse(this.withPayload(args));
	}

	tryCreateGroup(
		args: Omit<
			Parameters<typeof courseManagement.tryCreateGroup>[0],
			"payload"
		>,
	) {
		return CreateGroupArgs.tryCreateGroup(this.withPayload(args));
	}

	tryDeleteGroup(
		args: Omit<
			Parameters<typeof courseManagement.tryDeleteGroup>[0],
			"payload"
		>,
	) {
		return CreateGroupArgs.tryDeleteGroup(this.withPayload(args));
	}

	tryFindUserEnrollmentInCourse(
		args: Omit<
			Parameters<
				typeof enrollmentManagement.tryFindUserEnrollmentInCourse
			>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.tryFindUserEnrollmentInCourse(
			this.withPayload(args),
		);
	}

	// --- Course section management ---

	tryCreateSection(
		args: Omit<
			Parameters<typeof courseSectionManagement.tryCreateSection>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryCreateSection(
			this.withPayload(args),
		);
	}

	tryFindSectionsByCourse(
		args: Omit<
			Parameters<
				typeof courseSectionManagement.tryFindSectionsByCourse
			>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryFindSectionsByCourse(
			this.withPayload(args),
		);
	}

	tryUpdateSection(
		args: Omit<
			Parameters<typeof courseSectionManagement.tryUpdateSection>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryUpdateSection(
			this.withPayload(args),
		);
	}

	tryFindSectionById(
		args: Omit<
			Parameters<typeof courseSectionManagement.tryFindSectionById>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryFindSectionById(
			this.withPayload(args),
		);
	}

	tryDeleteSection(
		args: Omit<
			Parameters<typeof courseSectionManagement.tryDeleteSection>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryDeleteSection(
			this.withPayload(args),
		);
	}

	tryGetCourseStructure(
		args: Omit<
			Parameters<typeof courseSectionManagement.tryGetCourseStructure>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryGetCourseStructure(
			this.withPayload(args),
		);
	}

	tryGeneralMove(
		args: Omit<
			Parameters<typeof courseSectionManagement.tryGeneralMove>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryGeneralMove(
			this.withPayload(args),
		);
	}

	tryGetPreviousNextModule(
		args: Omit<
			Parameters<typeof courseSectionManagement.tryGetPreviousNextModule>[0],
			"payload"
		>,
	) {
		return courseSectionManagement.tryGetPreviousNextModule(
			this.withPayload(args),
		);
	}

	// --- Discussion management ---

	tryGradeDiscussionSubmission(
		args: Omit<
			Parameters<
				typeof discussionManagement.tryGradeDiscussionSubmission
			>[0],
			"payload"
		>,
	) {
		return discussionManagement.tryGradeDiscussionSubmission(
			this.withPayload(args),
		);
	}

	tryListDiscussionSubmissions(
		args: Omit<
			Parameters<
				typeof discussionManagement.tryListDiscussionSubmissions
			>[0],
			"payload"
		>,
	) {
		return discussionManagement.tryListDiscussionSubmissions(
			this.withPayload(args),
		);
	}

	tryGetDiscussionSubmissionById(
		args: Omit<
			Parameters<
				typeof discussionManagement.tryGetDiscussionSubmissionById
			>[0],
			"payload"
		>,
	) {
		return discussionManagement.tryGetDiscussionSubmissionById(
			this.withPayload(args),
		);
	}

	tryGetDiscussionThreadsWithAllReplies(
		args: Omit<
			Parameters<
				typeof discussionManagement.tryGetDiscussionThreadsWithAllReplies
			>[0],
			"payload"
		>,
	) {
		return discussionManagement.tryGetDiscussionThreadsWithAllReplies(
			this.withPayload(args),
		);
	}

	tryGetDiscussionThreadWithReplies(
		args: Omit<
			Parameters<
				typeof discussionManagement.tryGetDiscussionThreadWithReplies
			>[0],
			"payload"
		>,
	) {
		return discussionManagement.tryGetDiscussionThreadWithReplies(
			this.withPayload(args),
		);
	}

	// --- Email ---

	trySendEmail(
		args: Omit<Parameters<typeof email.trySendEmail>[0], "payload">,
	) {
		return email.trySendEmail(this.withPayload(args));
	}

	// --- Enrollment management ---

	tryFindEnrollmentsByUser(
		args: Omit<
			Parameters<typeof enrollmentManagement.tryFindEnrollmentsByUser>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.tryFindEnrollmentsByUser(
			this.withPayload(args),
		);
	}

	tryFindEnrollmentsByCourse(
		args: Omit<
			Parameters<
				typeof enrollmentManagement.tryFindEnrollmentsByCourse
			>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.tryFindEnrollmentsByCourse(
			this.withPayload(args),
		);
	}

	tryFindEnrollmentById(
		args: Omit<
			Parameters<typeof enrollmentManagement.tryFindEnrollmentById>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.tryFindEnrollmentById(
			this.withPayload(args),
		);
	}

	tryUpdateEnrollment(
		args: Omit<
			Parameters<typeof enrollmentManagement.tryUpdateEnrollment>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.tryUpdateEnrollment(
			this.withPayload(args),
		);
	}

	tryCreateEnrollment(
		args: Omit<
			Parameters<typeof enrollmentManagement.tryCreateEnrollment>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.tryCreateEnrollment(
			this.withPayload(args),
		);
	}

	tryDeleteEnrollment(
		args: Omit<
			Parameters<typeof enrollmentManagement.tryDeleteEnrollment>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.tryDeleteEnrollment(
			this.withPayload(args),
		);
	}

	trySearchEnrollments(
		args: Omit<
			Parameters<typeof enrollmentManagement.trySearchEnrollments>[0],
			"payload"
		>,
	) {
		return enrollmentManagement.trySearchEnrollments(
			this.withPayload(args),
		);
	}

	// --- Gradebook category management ---

	tryCreateGradebookCategory(
		args: Omit<
			Parameters<
				typeof gradebookCategoryManagement.tryCreateGradebookCategory
			>[0],
			"payload"
		>,
	) {
		return gradebookCategoryManagement.tryCreateGradebookCategory(
			this.withPayload(args),
		);
	}

	tryUpdateGradebookCategory(
		args: Omit<
			Parameters<
				typeof gradebookCategoryManagement.tryUpdateGradebookCategory
			>[0],
			"payload"
		>,
	) {
		return gradebookCategoryManagement.tryUpdateGradebookCategory(
			this.withPayload(args),
		);
	}

	tryDeleteGradebookCategory(
		args: Omit<
			Parameters<
				typeof gradebookCategoryManagement.tryDeleteGradebookCategory
			>[0],
			"payload"
		>,
	) {
		return gradebookCategoryManagement.tryDeleteGradebookCategory(
			this.withPayload(args),
		);
	}

	tryFindGradebookCategoryById(
		args: Omit<
			Parameters<
				typeof gradebookCategoryManagement.tryFindGradebookCategoryById
			>[0],
			"payload"
		>,
	) {
		return gradebookCategoryManagement.tryFindGradebookCategoryById(
			this.withPayload(args),
		);
	}

	tryGetNextSortOrder(
		args: Omit<
			Parameters<typeof gradebookCategoryManagement.tryGetNextSortOrder>[0],
			"payload"
		>,
	) {
		return gradebookCategoryManagement.tryGetNextSortOrder(
			this.withPayload(args),
		);
	}

	tryReorderCategories(
		args: Omit<
			Parameters<
				typeof gradebookCategoryManagement.tryReorderCategories
			>[0],
			"payload"
		>,
	) {
		return gradebookCategoryManagement.tryReorderCategories(
			this.withPayload(args),
		);
	}

	// --- Gradebook item management ---

	tryFindGradebookItemByCourseModuleLink(
		args: Omit<
			Parameters<
				typeof gradebookItemManagement.tryFindGradebookItemByCourseModuleLink
			>[0],
			"payload"
		>,
	) {
		return gradebookItemManagement.tryFindGradebookItemByCourseModuleLink(
			this.withPayload(args),
		);
	}

	tryCreateGradebookItem(
		args: Omit<
			Parameters<
				typeof gradebookItemManagement.tryCreateGradebookItem
			>[0],
			"payload"
		>,
	) {
		return gradebookItemManagement.tryCreateGradebookItem(
			this.withPayload(args),
		);
	}

	tryUpdateGradebookItem(
		args: Omit<
			Parameters<
				typeof gradebookItemManagement.tryUpdateGradebookItem
			>[0],
			"payload"
		>,
	) {
		return gradebookItemManagement.tryUpdateGradebookItem(
			this.withPayload(args),
		);
	}

	tryDeleteGradebookItem(
		args: Omit<
			Parameters<
				typeof gradebookItemManagement.tryDeleteGradebookItem
			>[0],
			"payload"
		>,
	) {
		return gradebookItemManagement.tryDeleteGradebookItem(
			this.withPayload(args),
		);
	}

	tryFindGradebookItemById(
		args: Omit<
			Parameters<
				typeof gradebookItemManagement.tryFindGradebookItemById
			>[0],
			"payload"
		>,
	) {
		return gradebookItemManagement.tryFindGradebookItemById(
			this.withPayload(args),
		);
	}

	tryGetNextItemSortOrder(
		args: Omit<
			Parameters<
				typeof gradebookItemManagement.tryGetNextItemSortOrder
			>[0],
			"payload"
		>,
	) {
		return gradebookItemManagement.tryGetNextItemSortOrder(
			this.withPayload(args),
		);
	}

	// --- Gradebook management ---

	tryGetGradebookByCourseWithDetails(
		args: Omit<
			Parameters<
				typeof gradebookManagement.tryGetGradebookByCourseWithDetails
			>[0],
			"payload"
		>,
	) {
		return gradebookManagement.tryGetGradebookByCourseWithDetails(
			this.withPayload(args),
		);
	}

	tryGetGradebookAllRepresentations(
		args: Omit<
			Parameters<
				typeof gradebookManagement.tryGetGradebookAllRepresentations
			>[0],
			"payload"
		>,
	) {
		return gradebookManagement.tryGetGradebookAllRepresentations(
			this.withPayload(args),
		);
	}

	// --- Maintenance settings ---

	tryGetMaintenanceSettings(
		args: Omit<
			Parameters<typeof maintenanceSettings.tryGetMaintenanceSettings>[0],
			"payload"
		>,
	) {
		return maintenanceSettings.tryGetMaintenanceSettings(
			this.withPayload(args),
		);
	}

	tryUpdateMaintenanceSettings(
		args: Omit<
			Parameters<typeof maintenanceSettings.tryUpdateMaintenanceSettings>[0],
			"payload"
		>,
	) {
		return maintenanceSettings.tryUpdateMaintenanceSettings(
			this.withPayload(args),
		);
	}

	// --- Media management ---

	tryGetMediaStreamFromId(
		args: Omit<
			Parameters<typeof mediaManagement.tryGetMediaStreamFromId>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryGetMediaStreamFromId(
			this.withPayload(args),
		);
	}

	tryFindMediaByUser(
		args: Omit<
			Parameters<typeof mediaManagement.tryFindMediaByUser>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryFindMediaByUser(this.withPayload(args));
	}

	tryFindMediaUsages(
		args: Omit<
			Parameters<typeof mediaManagement.tryFindMediaUsages>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryFindMediaUsages(this.withPayload(args));
	}

	tryCreateMedia(
		args: Omit<
			Parameters<typeof mediaManagement.tryCreateMedia>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryCreateMedia(this.withPayload(args));
	}

	tryRenameMedia(
		args: Omit<
			Parameters<typeof mediaManagement.tryRenameMedia>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryRenameMedia(this.withPayload(args));
	}

	tryGetUserMediaStats(
		args: Omit<
			Parameters<typeof mediaManagement.tryGetUserMediaStats>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryGetUserMediaStats(
			this.withPayload(args),
		);
	}

	tryGetSystemMediaStats(
		args: Omit<
			Parameters<typeof mediaManagement.tryGetSystemMediaStats>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryGetSystemMediaStats(
			this.withPayload(args),
		);
	}

	tryGetAllMedia(
		args: Omit<
			Parameters<typeof mediaManagement.tryGetAllMedia>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryGetAllMedia(this.withPayload(args));
	}

	tryDeleteMedia(
		args: Omit<
			Parameters<typeof mediaManagement.tryDeleteMedia>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryDeleteMedia(this.withPayload(args));
	}

	tryGetMediaById(
		args: Omit<
			Parameters<typeof mediaManagement.tryGetMediaById>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryGetMediaById(this.withPayload(args));
	}

	tryGetMediaByIds(
		args: Omit<
			Parameters<typeof mediaManagement.tryGetMediaByIds>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryGetMediaByIds(this.withPayload(args));
	}

	tryGetOrphanedMedia(
		args: Omit<
			Parameters<typeof mediaManagement.tryGetOrphanedMedia>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryGetOrphanedMedia(this.withPayload(args));
	}

	tryDeleteOrphanedMedia(
		args: Omit<
			Parameters<typeof mediaManagement.tryDeleteOrphanedMedia>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryDeleteOrphanedMedia(this.withPayload(args));
	}

	tryPruneAllOrphanedMedia(
		args: Omit<
			Parameters<typeof mediaManagement.tryPruneAllOrphanedMedia>[0],
			"payload"
		>,
	) {
		return mediaManagement.tryPruneAllOrphanedMedia(this.withPayload(args));
	}

	// --- Note management ---

	tryFindNotesByUser(
		args: Omit<
			Parameters<typeof noteManagement.tryFindNotesByUser>[0],
			"payload"
		>,
	) {
		return noteManagement.tryFindNotesByUser(this.withPayload(args));
	}

	tryFindNoteById(
		args: Omit<
			Parameters<typeof noteManagement.tryFindNoteById>[0],
			"payload"
		>,
	) {
		return noteManagement.tryFindNoteById(this.withPayload(args));
	}

	tryCreateNote(
		args: Omit<
			Parameters<typeof noteManagement.tryCreateNote>[0],
			"payload"
		>,
	) {
		return noteManagement.tryCreateNote(this.withPayload(args));
	}

	tryUpdateNote(
		args: Omit<
			Parameters<typeof noteManagement.tryUpdateNote>[0],
			"payload"
		>,
	) {
		return noteManagement.tryUpdateNote(this.withPayload(args));
	}

	tryDeleteNote(
		args: Omit<
			Parameters<typeof noteManagement.tryDeleteNote>[0],
			"payload"
		>,
	) {
		return noteManagement.tryDeleteNote(this.withPayload(args));
	}

	tryGenerateNoteHeatmap(
		args: Omit<
			Parameters<typeof noteManagement.tryGenerateNoteHeatmap>[0],
			"payload"
		>,
	) {
		return noteManagement.tryGenerateNoteHeatmap(
			this.withPayload(args),
		);
	}

	// --- Quiz submission management ---

	tryGetQuizSubmissionById(
		args: Omit<
			Parameters<
				typeof quizSubmissionManagement.tryGetQuizSubmissionById
			>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryGetQuizSubmissionById(
			this.withPayload(args),
		);
	}

	tryCreateQuiz(
		args: Omit<
			Parameters<typeof quizSubmissionManagement.tryCreateQuiz>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryCreateQuiz(
			this.withPayload(args),
		);
	}

	tryStartQuizAttempt(
		args: Omit<
			Parameters<
				typeof quizSubmissionManagement.tryStartQuizAttempt
			>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryStartQuizAttempt(
			this.withPayload(args),
		);
	}

	tryAnswerQuizQuestion(
		args: Omit<
			Parameters<
				typeof quizSubmissionManagement.tryAnswerQuizQuestion
			>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryAnswerQuizQuestion(
			this.withPayload(args),
		);
	}

	tryMarkQuizAttemptAsComplete(
		args: Omit<
			Parameters<
				typeof quizSubmissionManagement.tryMarkQuizAttemptAsComplete
			>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryMarkQuizAttemptAsComplete(
			this.withPayload(args),
		);
	}

	tryListQuizSubmissions(
		args: Omit<
			Parameters<
				typeof quizSubmissionManagement.tryListQuizSubmissions
			>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryListQuizSubmissions(
			this.withPayload(args),
		);
	}

	tryGradeQuizSubmission(
		args: Omit<
			Parameters<
				typeof quizSubmissionManagement.tryGradeQuizSubmission
			>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryGradeQuizSubmission(
			this.withPayload(args),
		);
	}

	tryCalculateQuizGrade(
		args: Omit<
			Parameters<
				typeof quizSubmissionManagement.tryCalculateQuizGrade
			>[0],
			"payload"
		>,
	) {
		return quizSubmissionManagement.tryCalculateQuizGrade(
			this.withPayload(args),
		);
	}

	// --- Registration settings ---

	tryGetRegistrationSettings(
		args: Omit<
			Parameters<typeof registrationSettings.tryGetRegistrationSettings>[0],
			"payload"
		>,
	) {
		return registrationSettings.tryGetRegistrationSettings(
			this.withPayload(args),
		);
	}

	tryUpdateRegistrationSettings(
		args: Omit<
			Parameters<typeof registrationSettings.tryUpdateRegistrationSettings>[0],
			"payload"
		>,
	) {
		return registrationSettings.tryUpdateRegistrationSettings(
			this.withPayload(args),
		);
	}

	// --- Scheduled tasks ---

	tryGetScheduledTasks() {
		return scheduledTasksManagement.tryGetScheduledTasks(
			this.getPayload(),
		);
	}

	// --- Cron jobs ---

	tryGetCronJobs(
		args: Omit<
			Parameters<typeof cronJobsManagement.tryGetCronJobs>[0],
			"payload"
		>,
	) {
		return cronJobsManagement.tryGetCronJobs(this.withPayload(args));
	}

	// --- Search management ---

	tryGlobalSearch(
		args: Omit<
			Parameters<typeof searchManagement.tryGlobalSearch>[0],
			"payload"
		>,
	) {
		return searchManagement.tryGlobalSearch(this.withPayload(args));
	}

	// --- Site policies ---

	tryGetSitePolicies(
		args: Omit<
			Parameters<typeof sitePolicies.tryGetSitePolicies>[0],
			"payload"
		>,
	) {
		return sitePolicies.tryGetSitePolicies(this.withPayload(args));
	}

	tryUpdateSitePolicies(
		args: Omit<
			Parameters<typeof sitePolicies.tryUpdateSitePolicies>[0],
			"payload"
		>,
	) {
		return sitePolicies.tryUpdateSitePolicies(this.withPayload(args));
	}

	// --- System globals ---

	tryGetSystemGlobals(
		args: Omit<
			Parameters<typeof systemGlobals.tryGetSystemGlobals>[0],
			"payload"
		>,
	) {
		return systemGlobals.tryGetSystemGlobals(this.withPayload(args));
	}

	// --- User grade management ---

	tryGetUserGradesJsonRepresentation(
		args: Omit<
			Parameters<
				typeof userGradeManagement.tryGetUserGradesJsonRepresentation
			>[0],
			"payload"
		>,
	) {
		return userGradeManagement.tryGetUserGradesJsonRepresentation(
			this.withPayload(args),
		);
	}

	tryGetSingleUserGradesJsonRepresentation(
		args: Omit<
			Parameters<
				typeof userGradeManagement.tryGetSingleUserGradesJsonRepresentation
			>[0],
			"payload"
		>,
	) {
		return userGradeManagement.tryGetSingleUserGradesJsonRepresentation(
			this.withPayload(args),
		);
	}

	tryGetAdjustedSingleUserGrades(
		args: Omit<
			Parameters<
				typeof userGradeManagement.tryGetAdjustedSingleUserGrades
			>[0],
			"payload"
		>,
	) {
		return userGradeManagement.tryGetAdjustedSingleUserGrades(
			this.withPayload(args),
		);
	}

	tryReleaseAssignmentGrade(
		args: Omit<
			Parameters<
				typeof userGradeManagement.tryReleaseAssignmentGrade
			>[0],
			"payload"
		>,
	) {
		return userGradeManagement.tryReleaseAssignmentGrade(
			this.withPayload(args),
		);
	}

	tryReleaseDiscussionGrade(
		args: Omit<
			Parameters<
				typeof userGradeManagement.tryReleaseDiscussionGrade
			>[0],
			"payload"
		>,
	) {
		return userGradeManagement.tryReleaseDiscussionGrade(
			this.withPayload(args),
		);
	}

	tryReleaseQuizGrade(
		args: Omit<
			Parameters<typeof userGradeManagement.tryReleaseQuizGrade>[0],
			"payload"
		>,
	) {
		return userGradeManagement.tryReleaseQuizGrade(
			this.withPayload(args),
		);
	}

	// --- User management ---

	tryFindUserById(
		args: Omit<
			Parameters<typeof userManagement.tryFindUserById>[0],
			"payload"
		>,
	) {
		return userManagement.tryFindUserById(this.withPayload(args));
	}

	tryFindAllUsers(
		args: Omit<
			Parameters<typeof userManagement.tryFindAllUsers>[0],
			"payload"
		>,
	) {
		return userManagement.tryFindAllUsers(this.withPayload(args));
	}

	tryCreateUser(
		args: Omit<
			Parameters<typeof userManagement.tryCreateUser>[0],
			"payload"
		>,
	) {
		return userManagement.tryCreateUser(this.withPayload(args));
	}

	tryUpdateUser(
		args: Omit<
			Parameters<typeof userManagement.tryUpdateUser>[0],
			"payload"
		>,
	) {
		return userManagement.tryUpdateUser(this.withPayload(args));
	}

	tryLogin(
		args: Omit<
			Parameters<typeof userManagement.tryLogin>[0],
			"payload"
		>,
	) {
		return userManagement.tryLogin(this.withPayload(args));
	}

	tryRegisterFirstUser(
		args: Omit<
			Parameters<typeof userManagement.tryRegisterFirstUser>[0],
			"payload"
		>,
	) {
		return userManagement.tryRegisterFirstUser(this.withPayload(args));
	}

	tryRegisterUser(
		args: Omit<
			Parameters<typeof userManagement.tryRegisterUser>[0],
			"payload"
		>,
	) {
		return userManagement.tryRegisterUser(this.withPayload(args));
	}

	tryGetUserCount(
		args: Omit<
			Parameters<typeof userManagement.tryGetUserCount>[0],
			"payload"
		>,
	) {
		return userManagement.tryGetUserCount(this.withPayload(args));
	}

	tryHandleImpersonation(
		args: Omit<
			Parameters<typeof userManagement.tryHandleImpersonation>[0],
			"payload"
		>,
	) {
		return userManagement.tryHandleImpersonation(
			this.withPayload(args),
		);
	}

	tryGenerateApiKey(
		args: Omit<
			Parameters<typeof userManagement.tryGenerateApiKey>[0],
			"payload"
		>,
	) {
		return userManagement.tryGenerateApiKey(this.withPayload(args));
	}

	tryGetApiKeyStatus(
		args: Omit<
			Parameters<typeof userManagement.tryGetApiKeyStatus>[0],
			"payload"
		>,
	) {
		return userManagement.tryGetApiKeyStatus(this.withPayload(args));
	}

	tryRevokeApiKey(
		args: Omit<
			Parameters<typeof userManagement.tryRevokeApiKey>[0],
			"payload"
		>,
	) {
		return userManagement.tryRevokeApiKey(this.withPayload(args));
	}

	// --- Version management ---

	tryGetLatestVersion(
		args: Parameters<typeof versionManagement.tryGetLatestVersion>[0],
	) {
		return versionManagement.tryGetLatestVersion(args);
	}
}
