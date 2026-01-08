import { transformError, UnknownError } from "app/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";
import type { LatestQuizConfig } from "server/json/raw-quiz-config/version-resolver";
import { Result } from "typescript-result";
import { stripDepth } from "./utils/internal-function-utils";

export interface UpdateQuizModuleV2Args extends BaseInternalFunctionArgs {
	id: number;
	description?: string;
	instructions?: string;
	rawQuizConfig?: LatestQuizConfig;
}

function processRawQuizConfig(rawQuizConfig: LatestQuizConfig) {
	return {
		rawQuizConfig,
	};
}

export function tryUpdateQuizModuleV2(args: UpdateQuizModuleV2Args) {
	return Result.try(
		async () => {
			const {
				payload,
				id,
				description,
				instructions,
				rawQuizConfig,
				req,
				overrideAccess = false,
			} = args;

			const updatedQuiz = await payload
				.update({
					collection: "quizzes",
					id,
					data: {
						description,
						instructions,
						...(rawQuizConfig ? processRawQuizConfig(rawQuizConfig) : {}),
					},
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">());

			return updatedQuiz;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update quiz module", { cause: error }),
	);
}
