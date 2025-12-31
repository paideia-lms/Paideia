/**
 * user access context:
 * this context is available when user is logged in
 * it stores all the activity modules that user has access to
 * it stores all the enrollments of this users
 * it stores all the notes created by this user with heatmap data
 */
import { createContext } from "react-router";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindEnrollmentsByUser } from "server/internal/enrollment-management";
import { tryGenerateNoteHeatmap } from "server/internal/note-management";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";
import type {
	ActivityModule as PayloadActivityModule,
	Course as PayloadCourse,
	Enrollment as PayloadEnrollment,
} from "server/payload-types";

type Course = {
	id: number;
	title: string;
	slug: string;
	status: PayloadCourse["status"];
	description: string;
	createdAt: string;
	updatedAt: string;
	category?: number | null;
};

type ActivityModule = {
	id: number;
	title: string;
	description: string;
	createdAt: string;
	updatedAt: string;
	type: PayloadActivityModule["type"];
	linkedCourses: number[];
	accessType: "owned" | "granted" | "readonly";
};

/**
 * all the user enrollments, the name, id, email, role, status, enrolledAt, completedAt
 */
export type Enrollment = {
	id: number;
	role: PayloadEnrollment["role"];
	status: PayloadEnrollment["status"];
	enrolledAt?: string | null;
	completedAt?: string | null;
	course: Course;
};

// export interface UserAccessContext {
// 	activityModules: ActivityModule[];
// 	enrollments: Enrollment[];
// 	notes: Note[];
// 	heatmapData: Record<string, number>;
// 	availableYears: number[];
// }

export type UserAccessContext = NonNullable<
	Awaited<ReturnType<typeof getUserAccessContext>>
>;

export const userAccessContext = createContext<UserAccessContext | null>(null);

export { userAccessContextKey } from "./utils/context-keys";

interface GetUserAccessContextArgs extends BaseInternalFunctionArgs {
	userId: number;
}

export const getUserAccessContext = async (args: GetUserAccessContextArgs) => {
	const { payload, userId, overrideAccess = false, req } = args;
	const { modulesOwnedOrGranted, autoGrantedModules } =
		await tryGetUserActivityModules(args).getOrThrow();

	const enrollments = await tryFindEnrollmentsByUser({
		payload,
		userId: userId,
		req,
		overrideAccess,
	}).getOrThrow();

	const enrollmentsData = enrollments.map((enrollment) => ({
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
			category: enrollment.course.category ?? null,
			thumbnail: enrollment.course.thumbnail ?? null,
		},
	})) satisfies Enrollment[];

	const activityModules = [
		...modulesOwnedOrGranted.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			linkedCourses: module.linkedCourses,
			accessType:
				module.owner.id === userId ? ("owned" as const) : ("granted" as const),
		})),
		...autoGrantedModules.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			linkedCourses: module.linkedCourses.map((c) => c.id),
			accessType: "readonly" as const,
		})),
	] satisfies ActivityModule[];

	// Fetch notes and heatmap data
	const heatmapResult = await tryGenerateNoteHeatmap({
		payload,
		userId,
		req,
		overrideAccess,
	}).getOrThrow();

	const { notes, heatmapData, availableYears } = heatmapResult;

	return {
		activityModules: activityModules.filter(
			// unique by id
			(module, index, self) =>
				self.findIndex((m) => m.id === module.id) === index,
		),
		enrollments: enrollmentsData,
		notes,
		heatmapData,
		availableYears,
	};
};
