import type {
	FillInTheBlankQuestion as FillInTheBlankQuestionV1,
	Question as QuestionV1,
	QuizConfig as QuizConfigV1,
	QuizPage as QuizPageV1,
} from "./raw-quiz-config.types";
import type {
	FillInTheBlankQuestion as FillInTheBlankQuestionV2,
	NestedQuizConfig,
	Question as QuestionV2,
	QuizConfig as QuizConfigV2,
	QuizPage as QuizPageV2,
} from "./raw-quiz-config.types.v2";

/**
 * Type guard to check if a config is already v2
 */
function isV2Config(config: unknown): config is QuizConfigV2 {
	return (
		typeof config === "object" &&
		config !== null &&
		"version" in config &&
		config.version === "v2"
	);
}

/**
 * Converts a v1 fill-in-the-blank question to v2 format
 * V1 uses string[] for correctAnswers, V2 uses Record<string, string>
 */
function convertFillInTheBlankQuestion(
	question: FillInTheBlankQuestionV1,
): FillInTheBlankQuestionV2 {
	const v1Answers = question.correctAnswers || [];

	// Parse blank IDs from the prompt
	const blankMatches = Array.from(
		(question.prompt || "").matchAll(/\{\{([^}]+)\}\}/g),
	);
	const blankIds = blankMatches.map((match) => match[1]);

	// Get unique blank IDs in order of first appearance
	const uniqueBlankIds = Array.from(new Set(blankIds));

	// Convert array to record by mapping indices to blank IDs
	const correctAnswers: Record<string, string> = {};
	for (let i = 0; i < uniqueBlankIds.length && i < v1Answers.length; i++) {
		correctAnswers[uniqueBlankIds[i]] = v1Answers[i];
	}

	return {
		...question,
		correctAnswers,
	};
}

/**
 * Converts a v1 question to v2 format
 */
function convertQuestion(question: QuestionV1): QuestionV2 {
	if (question.type === "fill-in-the-blank") {
		return convertFillInTheBlankQuestion(
			question as FillInTheBlankQuestionV1,
		);
	}
	// All other question types remain the same
	return question as QuestionV2;
}

/**
 * Converts v1 pages to v2 format
 */
function convertPages(pages: QuizPageV1[]): QuizPageV2[] {
	return pages.map((page) => ({
		...page,
		questions: page.questions.map(convertQuestion),
	}));
}

/**
 * Type guard to check if a v1 config is a container quiz
 */
function isV1ContainerQuiz(config: QuizConfigV1): boolean {
	return (
		config.nestedQuizzes !== undefined &&
		Array.isArray(config.nestedQuizzes) &&
		config.nestedQuizzes.length > 0
	);
}

/**
 * Type guard to check if a v1 config is a regular quiz
 */
function isV1RegularQuiz(config: QuizConfigV1): boolean {
	return (
		config.pages !== undefined &&
		Array.isArray(config.pages) &&
		config.pages.length > 0
	);
}

/**
 * Converts a v1 quiz config to v2 format
 */
function convertV1ToV2(config: QuizConfigV1): QuizConfigV2 {
	// Container quiz (has nestedQuizzes)
	if (isV1ContainerQuiz(config)) {
		const nestedQuizzes = config.nestedQuizzes || [];

		// Convert nested quizzes to v2 format with resources
		const convertedNestedQuizzes: NestedQuizConfig[] = nestedQuizzes.map(
			(nq) => ({
				id: nq.id,
				title: nq.title,
				description: nq.description,
				pages: convertPages(nq.pages),
				resources: config.resources, // Move resources from parent to nested quizzes in v2
				globalTimer: nq.globalTimer,
				grading: nq.grading,
			}),
		);

		return {
			version: "v2",
			type: "container",
			id: config.id,
			title: config.title,
			nestedQuizzes: convertedNestedQuizzes,
			sequentialOrder: config.sequentialOrder,
			globalTimer: config.globalTimer,
			grading: config.grading,
		};
	}

	// Regular quiz (has pages)
	if (isV1RegularQuiz(config)) {
		const pages = config.pages || [];

		return {
			version: "v2",
			type: "regular",
			id: config.id,
			title: config.title,
			pages: convertPages(pages),
			resources: config.resources,
			globalTimer: config.globalTimer,
			grading: config.grading,
		};
	}

	// Fallback: empty regular quiz
	return {
		version: "v2",
		type: "regular",
		id: config.id,
		title: config.title,
		pages: [],
		resources: config.resources,
		globalTimer: config.globalTimer,
		grading: config.grading,
	};
}

/**
 * Resolves a quiz config of unknown version to the latest version (v2)
 * @param config - Unknown quiz config (could be v1 or v2)
 * @returns Quiz config in v2 format
 */
export function resolveQuizConfigToLatest(config: unknown): QuizConfigV2 {
	// Validate input
	if (!config || typeof config !== "object") {
		throw new Error("Invalid quiz config: must be an object");
	}

	if (!("id" in config) || !("title" in config)) {
		throw new Error("Invalid quiz config: missing required fields (id, title)");
	}

	// Already v2, return as-is
	if (isV2Config(config)) {
		return config;
	}

	// Convert v1 to v2
	return convertV1ToV2(config as QuizConfigV1);
}

/**
 * Type guard to check if an unknown value is a valid quiz config
 */
export function isValidQuizConfig(
	value: unknown,
): value is QuizConfigV1 | QuizConfigV2 {
	if (!value || typeof value !== "object") {
		return false;
	}

	const obj = value as Record<string, unknown>;

	// Must have id and title
	if (typeof obj.id !== "string" || typeof obj.title !== "string") {
		return false;
	}

	// If it has version field, it must be v2
	if ("version" in obj) {
		return (
			obj.version === "v2" &&
			"type" in obj &&
			(obj.type === "regular" || obj.type === "container")
		);
	}

	// v1 must have either pages or nestedQuizzes
	const hasPages = "pages" in obj && Array.isArray(obj.pages);
	const hasNestedQuizzes =
		"nestedQuizzes" in obj && Array.isArray(obj.nestedQuizzes);

	return hasPages || hasNestedQuizzes;
}

/**
 * Safely resolves a quiz config to the latest version with validation
 * Returns null if the config is invalid
 */
export function tryResolveQuizConfigToLatest(
	config: unknown,
): QuizConfigV2 | null {
	try {
		if (!isValidQuizConfig(config)) {
			return null;
		}
		return resolveQuizConfigToLatest(config);
	} catch {
		return null;
	}
}
