import { createContext } from "react-router";

// Temporary interface until course module collection is created
export interface CourseModule {
	id: string;
	courseId: number;
	title: string;
	description?: string;
	content?: string;
	type: "video" | "text" | "quiz" | "assignment" | "discussion";
	position: number;
	duration?: number; // in minutes
	isCompleted: boolean;
	isLocked: boolean;
	prerequisites?: string[]; // module IDs
}

export interface CourseModuleContext {
	module: CourseModule;
	moduleId: string;
	position: number;
	isCompleted: boolean;
	canAccess: boolean;
	nextModule?: CourseModule;
	previousModule?: CourseModule;
}

export const courseModuleContext = createContext<CourseModuleContext | null>(
	null,
);

export const courseModuleContextKey =
	"courseModuleContext" as unknown as typeof courseModuleContext;
