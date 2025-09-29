import { createContext } from "react-router";

// Temporary interface until enrolment collection is created
export interface Enrolment {
	id: string;
	userId: number;
	courseId: number;
	status: "active" | "completed" | "cancelled" | "expired";
	enrolledAt: string;
	completedAt?: string;
	progress: number; // percentage 0-100
	lastAccessedAt?: string;
}

export interface EnrolmentContext {
	enrolment: Enrolment;
	isActive: boolean;
	progress: number;
	canAccessCourse: boolean;
}

export const enrolmentContext = createContext<EnrolmentContext | null>(null);

export const enrolmentContextKey =
	"enrolmentContext" as unknown as typeof enrolmentContext;
