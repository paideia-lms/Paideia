import { createContext } from "react-router";
import type { Course as PayloadCourse } from "server/payload-types";

export interface Course {
	id: number;
	title: string;
	slug: string;
	description: string;
	status: "draft" | "published" | "archived";
	structure: PayloadCourse["structure"];
	createdBy: {
		id: number;
		email: string;
		firstName?: string | null;
		lastName?: string | null;
	};
	category?: number | null;
	updatedAt: string;
	createdAt: string;
}

export interface CourseContext {
	course: Course;
	courseId: number;
}

export const courseContext = createContext<CourseContext | null>(null);

export const courseContextKey =
	"courseContext" as unknown as typeof courseContext;
