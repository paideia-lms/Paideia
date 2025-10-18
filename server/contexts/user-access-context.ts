/**
 * user access context:
 * this context is available when user is logged in
 * it stores all the activity modules that user has access to
 * it stores all the enrollments of this users
 * it stores all the notes created by this user with heatmap data
 */
import type { Payload } from "payload";
import { createContext } from "react-router";
import type { User } from "server/contexts/user-context";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindEnrollmentsByUser } from "server/internal/enrollment-management";
import { tryGenerateNoteHeatmap } from "server/internal/note-management";
import type { Note } from "server/payload-types";

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
};

type ActivityModule = {
	id: number;
	title: string;
	description: string;
	createdAt: string;
	updatedAt: string;
	type: "quiz" | "assignment" | "discussion" | "page" | "whiteboard";
	status: "draft" | "published" | "archived";
	linkedCourses: number[];
};

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
	notes: Note[];
	heatmapData: Record<string, number>;
	availableYears: number[];
}

export const userAccessContext = createContext<UserAccessContext | null>(null);

export const userAccessContextKey =
	"userAccessContext" as unknown as typeof userAccessContext;

export const getUserAccessContext = async (
	payload: Payload,
	/**
	 * the target user id
	 */
	userId: number,
	/**
	 * the current user, need to verify the access
	 */
	user: User,
): Promise<UserAccessContext | null> => {
	const result = await tryGetUserActivityModules(payload, {
		userId: userId,
		user: {
			...user,
			collection: "users",
		},
		overrideAccess: true,
	});

	if (!result.ok) throw new Error(result.error.message, {
		cause: result.error,
	});

	const { modulesOwnedOrGranted, autoGrantedModules } = result.value;

	const enrollments = await tryFindEnrollmentsByUser(
		payload,
		user.id,
		{
			...user,
			avatar: user.avatar?.id,
		},
		undefined,
		true,
	);

	if (!enrollments.ok) throw new Error("Failed to get user enrollments");

	const enrollmentsData = enrollments.value.map(
		(enrollment) =>
			({
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
			}) satisfies Enrollment,
	);

	const activityModules = [
		...modulesOwnedOrGranted.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			status: module.status,
			linkedCourses: module.linkedCourses,
		})),
		...autoGrantedModules.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			status: module.status,
			linkedCourses: module.linkedCourses.map((c) => c.id),
		})),
	] satisfies ActivityModule[];

	// Fetch notes and heatmap data
	const heatmapResult = await tryGenerateNoteHeatmap({
		payload,
		userId,
		user: {
			...user,
			collection: "users",
			avatar: user.avatar?.id,
		},
		overrideAccess: false,
	});

	const { notes, heatmapData, availableYears } = heatmapResult.ok
		? heatmapResult.value
		: { notes: [], heatmapData: {}, availableYears: [] };

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
