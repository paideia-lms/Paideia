import { createContext } from "react-router";
import type { CourseContext } from "./course-context";
export interface EnrolmentContext {
	enrolment: CourseContext["course"]["enrollments"][number];
}

export const enrolmentContext = createContext<EnrolmentContext | null>(null);

export { enrolmentContextKey } from "./utils/context-keys";
