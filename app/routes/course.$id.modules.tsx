import { Container } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userAccessContextKey } from "server/contexts/user-access-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateCourseActivityModuleLink,
	tryDeleteCourseActivityModuleLink,
} from "server/internal/course-activity-module-link-management";
import { tryCreateSection } from "server/internal/course-section-management";
import { canSeeCourseModules } from "server/utils/permissions";
import { ActivityModulesSection } from "~/components/activity-modules-section";
import {
	BadRequestResponse,
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.modules";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);
	const userAccessContext = context.get(userAccessContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new BadRequestResponse("Invalid course ID");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const canEdit = canSeeCourseModules(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrolmentContext?.enrolment
			? {
					id: enrolmentContext.enrolment.id,
					userId: enrolmentContext.enrolment.userId,
					role: enrolmentContext.enrolment.role,
				}
			: undefined,
	);

	if (!canEdit) {
		throw new ForbiddenResponse(
			"You don't have permission to manage this course",
		);
	}

	// Get available modules from user access context
	const availableModules =
		userAccessContext?.activityModules.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description,
			type: module.type,
			status: module.status,
		})) ?? [];

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		canEdit,
		availableModules,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({ error: "Invalid course ID" });
	}

	// Get user's enrollment for this course
	const enrollments = await payload.find({
		collection: "enrollments",
		where: {
			and: [
				{ user: { equals: currentUser.id } },
				{ course: { equals: courseId } },
			],
		},
		limit: 1,
	});

	const enrollment = enrollments.docs[0];

	// Check if user has management access to this course
	const canManage = canSeeCourseModules(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrollment
			? {
					id: enrollment.id,
					userId: enrollment.user as number,
					role: enrollment.role,
				}
			: undefined,
	);

	if (!canManage) {
		return unauthorized({
			error: "You don't have permission to manage this course",
		});
	}

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "create") {
		const activityModuleId = Number(formData.get("activityModuleId"));
		if (Number.isNaN(activityModuleId)) {
			return badRequest({ error: "Invalid activity module ID" });
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			return badRequest({ error: "Failed to begin transaction" });
		}

		try {
			// Create a default section if none exists
			const sectionResult = await tryCreateSection({
				payload,
				data: {
					course: courseId,
					title: "Default Section",
					description: "Default section for activity modules",
				},
				req: { ...request, transactionID },
				overrideAccess: true,
			});

			if (!sectionResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: "Failed to create section" });
			}

			const createResult = await tryCreateCourseActivityModuleLink(
				payload,
				request,
				{
					course: courseId,
					activityModule: activityModuleId,
					section: sectionResult.value.id,
					order: 0,
					transactionID,
				},
			);

			if (!createResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: createResult.error.message });
			}

			await payload.db.commitTransaction(transactionID);
			return ok({
				success: true,
				message: "Activity module linked successfully",
			});
		} catch {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: "Failed to create link" });
		}
	}

	if (intent === "delete") {
		const linkId = Number(formData.get("linkId"));
		if (Number.isNaN(linkId)) {
			return badRequest({ error: "Invalid link ID" });
		}

		const deleteResult = await tryDeleteCourseActivityModuleLink(
			payload,
			request,
			linkId,
		);

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({ success: true, message: "Link deleted successfully" });
	}

	return badRequest({ error: "Invalid intent" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData && "success" in actionData && actionData.success) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	} else if (actionData && "error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

export default function CourseModulesPage({
	loaderData,
}: Route.ComponentProps) {
	const fetcher = useFetcher<typeof action>();

	const { course, canEdit, availableModules } = loaderData;

	const handleDeleteLink = (linkId: number) => {
		fetcher.submit(
			{ intent: "delete", linkId: linkId.toString() },
			{ method: "post" },
		);
	};

	const handleCreateLink = (activityModuleId: number) => {
		fetcher.submit(
			{ intent: "create", activityModuleId: activityModuleId.toString() },
			{ method: "post" },
		);
	};

	const title = `${course.title} - Modules | Paideia LMS`;

	return (
		<Container size="lg" py="xl">
			<title>{title}</title>
			<meta name="description" content={`${course.title} modules management`} />
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`${course.title} modules management`}
			/>

			<ActivityModulesSection
				existingLinks={course.moduleLinks.map((link) => ({
					id: link.id,
					activityModule: {
						id: String(link.activityModule.id),
						title: link.activityModule.title || "",
						type: link.activityModule.type,
						status: link.activityModule.status,
						description: link.activityModule.description,
					},
					createdAt: link.createdAt,
				}))}
				availableModules={availableModules}
				canEdit={canEdit}
				fetcherState={fetcher.state}
				onAddModule={handleCreateLink}
				onDeleteLink={handleDeleteLink}
			/>
		</Container>
	);
}
