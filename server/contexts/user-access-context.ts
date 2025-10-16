/**
 * user access context:
 * this context is available when user is logged in
 * it stores all the activity modules that user has access to
 * it stores all the enrollments of this users 
 */
import type { Payload } from "payload";
import { createContext } from "react-router";
import type { User } from "server/contexts/user-context"
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindEnrollmentsByUser } from "server/internal/enrollment-management";


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
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    type: "quiz" | "assignment" | 'discussion' | 'page' | 'whiteboard';
    status: "draft" | "published" | "archived";
    linkedCourses: number[];
}

/**
 * all the user enrollments, the name, id, email, role, status, enrolledAt, completedAt
 */
export type Enrollment = {
    id: number;
    role: "student" | "teacher" | "ta" | "manager";
    status: "active" | "inactive" | "completed" | "dropped";
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

export const getUserAccessContext = async (
    payload: Payload,
    user: User,
): Promise<UserAccessContext | null> => {
    const result = await tryGetUserActivityModules(payload, {
        userId: user.id,
        user: {
            ...user,
            collection: "users",
        },
        overrideAccess: true,
    })

    if (!result.ok) throw new Error("Failed to get user activity modules");

    const { modulesOwnedOrGranted, autoGrantedModules } = result.value;

    const enrollments = await tryFindEnrollmentsByUser(payload, user.id, {
        ...user,
        avatar: user.avatar?.id,
    }, undefined, true);

    if (!enrollments.ok) throw new Error("Failed to get user enrollments");

    const enrollmentsData = enrollments.value.map(enrollment => ({
        id: enrollment.id,
        role: enrollment.role,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        course: {
            id: enrollment.course.id,
            title: enrollment.course.title,
            slug: enrollment.course.slug,
            status: enrollment.course.status,
            description: enrollment.course.description,
            createdAt: enrollment.course.createdAt,
            updatedAt: enrollment.course.updatedAt,
        },

    }) satisfies Enrollment);


    const activityModules = [...modulesOwnedOrGranted.map(module => ({
        id: module.id,
        title: module.title,
        description: module.description ?? "",
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
        type: module.type,
        status: module.status,
        linkedCourses: module.linkedCourses
    })), ...autoGrantedModules.map(module => ({
        id: module.id,
        title: module.title,
        description: module.description ?? "",
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
        type: module.type,
        status: module.status,
        linkedCourses: module.linkedCourses.map(c => c.id)
    }))] satisfies ActivityModule[];

    return {
        activityModules: activityModules,
        enrollments: enrollmentsData,
    }
}