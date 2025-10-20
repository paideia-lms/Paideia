import { createContext } from "react-router";

// Temporary interface until course module collection is created
export interface CourseModule {
	id: string;
	courseId: number;
	title: string;
	description?: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status: "draft" | "published" | "archived";
	createdBy: {
		id: number;
		email: string;
		firstName?: string | null;
		lastName?: string | null;
		avatar: {
			id: number;
			filename?: string | null;
		} | null;
	};
	updatedAt: string;
	createdAt: string;
}

export interface CourseModuleContext {
	module: CourseModule;
	moduleId: string;
	nextModule?: CourseModule;
	previousModule?: CourseModule;
}

export const courseModuleContext = createContext<CourseModuleContext | null>(
	null,
);

export const courseModuleContextKey =
	"courseModuleContext" as unknown as typeof courseModuleContext;
