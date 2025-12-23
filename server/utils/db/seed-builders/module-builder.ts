import type { SeedData } from "../seed-schema";
import type { LatestQuizConfig } from "server/json";
import {
	type ActivityModuleResult,
	tryCreateAssignmentModule,
	tryCreateDiscussionModule,
	tryCreatePageModule,
	tryCreateQuizModule,
	tryCreateWhiteboardModule,
} from "../../../internal/activity-module-management";
import { getVfsFileText } from "../seed-utils/vfs-utils";
import { seedLogger } from "../seed-utils/logger";
import type { SeedContext } from "./user-builder";

export interface CreatedModules {
	page: ActivityModuleResult;
	additional: ActivityModuleResult[];
}

/**
 * Creates whiteboard fixture loader with state tracking
 */
function createWhiteboardFixtureLoader(): () => Promise<string> {
	let loaded = false;

	return async () => {
		if (loaded) {
			return JSON.stringify({ shapes: [], bindings: [] });
		}

		loaded = true;
		const fixtureContent = await getVfsFileText("fixture/whiteboard-data.json");

		if (!fixtureContent) {
			seedLogger.warning(
				"Skipping whiteboard fixture: whiteboard-data.json not found, using empty default",
			);
			return JSON.stringify({ shapes: [], bindings: [] });
		}

		try {
			const parsed = JSON.parse(fixtureContent);
			return JSON.stringify(parsed);
		} catch (error) {
			seedLogger.error(`Invalid JSON in whiteboard-data.json: ${error}`);
			return JSON.stringify({ shapes: [], bindings: [] });
		}
	};
}

/**
 * Creates a single activity module based on type
 */
async function createModule(
	ctx: SeedContext,
	adminUserId: number,
	moduleData: SeedData["modules"]["additional"][number],
	whiteboardLoader: () => Promise<string>,
): Promise<ActivityModuleResult> {
	const baseArgs = {
		payload: ctx.payload,
		userId: adminUserId,
		user: null,
		req: ctx.req,
		overrideAccess: true,
	};

	switch (moduleData.type) {
		case "page": {
			return (await tryCreatePageModule({
				...baseArgs,
				title: moduleData.title,
				description: moduleData.description,
				status: moduleData.status,
				content: moduleData.content,
			}).getOrThrow()) as ActivityModuleResult;
		}
		case "whiteboard": {
			const whiteboardContent = await whiteboardLoader();
			return (await tryCreateWhiteboardModule({
				...baseArgs,
				title: moduleData.title,
				description: moduleData.description,
				status: moduleData.status,
				content: whiteboardContent,
			}).getOrThrow()) as ActivityModuleResult;
		}
		case "assignment": {
			return (await tryCreateAssignmentModule({
				...baseArgs,
				title: moduleData.title,
				description: moduleData.description,
				status: moduleData.status,
				instructions: moduleData.instructions,
			}).getOrThrow()) as ActivityModuleResult;
		}
		case "quiz": {
			const quizArgs: Parameters<typeof tryCreateQuizModule>[0] = {
				...baseArgs,
				title: moduleData.title,
				description: moduleData.description,
				status: moduleData.status,
				instructions: moduleData.instructions,
				points: moduleData.points,
				timeLimit: moduleData.timeLimit,
			};
			if (moduleData.rawQuizConfig) {
				quizArgs.rawQuizConfig = moduleData.rawQuizConfig as LatestQuizConfig;
			}
			return (await tryCreateQuizModule(
				quizArgs,
			).getOrThrow()) as ActivityModuleResult;
		}
		case "discussion": {
			return (await tryCreateDiscussionModule({
				...baseArgs,
				title: moduleData.title,
				description: moduleData.description,
				status: moduleData.status,
				instructions: moduleData.instructions,
				minReplies: moduleData.minReplies,
				threadSorting: moduleData.threadSorting,
			}).getOrThrow()) as ActivityModuleResult;
		}
		default:
			throw new Error(
				`Unknown module type: ${(moduleData as { type: string }).type}`,
			);
	}
}

/**
 * Creates all activity modules for seeding
 */
export async function buildModules(
	ctx: SeedContext,
	data: SeedData,
	adminUserId: number,
): Promise<CreatedModules> {
	seedLogger.section("Creating Activity Modules");

	const baseArgs = {
		payload: ctx.payload,
		userId: adminUserId,
		user: null,
		req: ctx.req,
		overrideAccess: true,
	};

	// Create page module
	const page = await tryCreatePageModule({
		...baseArgs,
		title: data.modules.page.title,
		description: data.modules.page.description,
		status: "published",
		content: data.modules.page.content,
	}).getOrThrow();
	seedLogger.success(`Page module created with ID: ${page.id}`);

	// Create additional modules
	const additional: ActivityModuleResult[] = [];
	const whiteboardLoader = createWhiteboardFixtureLoader();

	for (const moduleData of data.modules.additional) {
		const module = await createModule(
			ctx,
			adminUserId,
			moduleData,
			whiteboardLoader,
		);
		additional.push(module);
	}

	seedLogger.success(
		`Additional modules created: ${additional.length} modules`,
	);

	return { page, additional };
}
