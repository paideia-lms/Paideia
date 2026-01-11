import type {
	NestedQuizConfig,
	QuizAnswers,
	RegularQuizConfig,
} from "server/json/raw-quiz-config/v2";
import { loaderSearchParams } from "../../route";
import { useNuqsSearchParams } from "app/utils/search-params-utils";

interface UseQuizFormOptions {
	quizConfig: RegularQuizConfig | NestedQuizConfig;
	readonly?: boolean;
	initialAnswers?: QuizAnswers;
	currentPageIndex?: number;
}

interface UseQuizFormReturn {
	currentPageIndex: number;
	answers: QuizAnswers;
	goToNextPage: () => void;
	goToPreviousPage: () => void;
	goToPage: (pageIndex: number) => void;
	isFirstPage: boolean;
	isLastPage: boolean;
	readonly: boolean;
}

export function useQuizForm({
	quizConfig,
	readonly = false,
	initialAnswers = {},
	currentPageIndex = 0,
}: UseQuizFormOptions): UseQuizFormReturn {
	const setSearchParams = useNuqsSearchParams(loaderSearchParams);

	const setCurrentPageIndex = (pageIndex: number) => {
		setSearchParams({ quizPageIndex: pageIndex });
	};

	const answers = initialAnswers || {};

	const goToNextPage = () => {
		if (quizConfig.pages && currentPageIndex < quizConfig.pages.length - 1) {
			setCurrentPageIndex(currentPageIndex + 1);
		}
	};

	const goToPreviousPage = () => {
		if (currentPageIndex > 0) {
			setCurrentPageIndex(currentPageIndex - 1);
		}
	};

	const goToPage = (pageIndex: number) => {
		if (
			quizConfig.pages &&
			pageIndex >= 0 &&
			pageIndex < quizConfig.pages.length
		) {
			setCurrentPageIndex(pageIndex);
		}
	};

	const isFirstPage = currentPageIndex === 0;
	const isLastPage = quizConfig.pages
		? currentPageIndex === quizConfig.pages.length - 1
		: false;

	return {
		currentPageIndex,
		answers,
		goToNextPage,
		goToPreviousPage,
		goToPage,
		isFirstPage,
		isLastPage,
		readonly,
	};
}
