/**
 * user access context:
 * this context is available when user is logged in
 * it stores all the activity modules that user has access to
 * it stores all the enrollments of this users 
 */
import { createContext } from "react-router";


type Course = {
    id: number;
    title: string;
    slug: string;
    status: "draft" | "published" | "archived";
    description: string;
    createdAt: string;
    updatedAt: string;
    category?: {
        id: number;
        name: string;
        parent?: {
            id: number;
            name: string;
        } | null;
    } | null;
}

type ActivityModule = {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    type: "quiz" | "assignment" | 'discussion' | 'page' | 'whiteboard';
    status: "draft" | "published" | "archived";
}

/**
 * all the user enrollments, the name, id, email, role, status, enrolledAt, completedAt
 */
export type Enrollment = {
    name: string;
    id: number;
    email: string;
    role: "student" | "teacher" | "ta" | "manager";
    status: "active" | "inactive" | "completed" | "dropped";
    avatar: {
        id: number;
        filename?: string | null;
    } | null;
    enrolledAt?: string | null;
    completedAt?: string | null;
    course: Course;
};

export interface UserAccessContext {
    activityModules: ActivityModule[];
    enrollments: Enrollment[];
}

export const userAccessContext = createContext<UserAccessContext | null>(null);

export const userAccessContextKey = "userAccessContext" as unknown as typeof userAccessContext;