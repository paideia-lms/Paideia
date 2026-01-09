import type { Route } from "../../+types/route";

type QuizModule = Extract<
	Route.ComponentProps["loaderData"]["module"],
	{ type: "quiz" }
>;

export type QuizConfig = NonNullable<QuizModule["rawQuizConfig"]>;

export type RegularQuizConfig = Extract<QuizConfig, { type: "regular" }>;
export type ContainerQuizConfig = Extract<QuizConfig, { type: "container" }>;

export type QuizPage = RegularQuizConfig["pages"][number];

export type Question = QuizPage["questions"][number];

export type QuizResource = NonNullable<RegularQuizConfig["resources"]>[number];

export type NestedQuizConfig = ContainerQuizConfig["nestedQuizzes"][number];

// Helper type to get pages from either regular or nested quiz config
export type PagesFromConfig<T extends QuizConfig> = T extends {
	type: "regular";
}
	? T["pages"]
	: T extends { type: "container" }
		? T["nestedQuizzes"][number]["pages"]
		: never;

// Helper type to get resources from either regular or nested quiz config
export type ResourcesFromConfig<T extends QuizConfig> = T extends {
	type: "regular";
}
	? NonNullable<T["resources"]>
	: T extends { type: "container" }
		? NonNullable<T["nestedQuizzes"][number]["resources"]>
		: never;
