import { createContext } from "react-router";

import type { Enrollment } from "./course-context";

export interface EnrolmentContext {
	enrolment: Enrollment;
}

export const enrolmentContext = createContext<EnrolmentContext | null>(null);

export const enrolmentContextKey =
	"enrolmentContext" as unknown as typeof enrolmentContext;
