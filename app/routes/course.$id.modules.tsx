import { Container } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	parseAsStringEnum as parseAsStringEnum,
} from "nuqs/server";
import { stringify } from "qs";
import { href, redirect } from "react-router";
import { createActionMap, typeCreateActionRpc } from "~/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { serverOnly$ } from "vite-env-only/macros";
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
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "server/internal/utils/handle-transaction-id";
import { permissions } from "server/utils/permissions";
import { z } from "zod";
import { ActivityModulesSection } from "~/components/activity-modules-section";
import {
	badRequest,
	BadRequestResponse,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.modules";
import { tryFindUserEnrollmentInCourse } from "server/internal/enrollment-management";

enum Action {
	Create = "create",
	Delete = "delete",
}

// Define search params for module link actions (used in actions)
export const moduleLinkSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

export function getRouteUrl(action: Action, courseId: number) {
	return (
		href("/course/:courseId/modules", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
}

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createCreateModuleLinkActionRpc = createActionRpc({
	formDataSchema: z.object({
		activityModuleId: z.coerce.number(),
		sectionId: z.coerce.number().optional(),
	}),
	method: "POST",
	action: Action.Create,
});

const createDeleteModuleLinkActionRpc = createActionRpc({
	formDataSchema: z.object({
		linkId: z.coerce.number(),
		redirectTo: z.string().nullish(),
	}),
	method: "POST",
	action: Action.Delete,
});

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);
	const userAccessContext = context.get(userAccessContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const canEdit = courseContext.permissions.canEdit;

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
		})) ?? [];

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		canEdit,
		availableModules,
	};
});

// Shared authorization check
const checkAuthorization = async (
	context: Route.ActionArgs["context"],
	courseId: number,
) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user's enrollment for this course
	const enrollmentResult = await tryFindUserEnrollmentInCourse({
		payload,
		userId: currentUser.id,
		courseId,
		req: payloadRequest,
	});

	if (!enrollmentResult.ok) {
		throw new BadRequestResponse(enrollmentResult.error.message);
	}
	const enrollment = enrollmentResult.value;

	// Check if user has management access to this course
	const canManage = permissions.course.canSeeModules(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrollment
			? {
				id: enrollment.id,
				role: enrollment.role,
			}
			: undefined,
	);

	if (!canManage) {
		return unauthorized({
			error: "You don't have permission to manage this course",
		});
	}

	return null;
};

const [createAction, useCreateModuleLink] = createCreateModuleLinkActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const { courseId } = params;
		const courseIdNum = Number(courseId);

		const authError = await checkAuthorization(context, courseIdNum);
		if (authError) return authError;

		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		// Use provided section ID or create a default section
		let targetSectionId = formData.sectionId;

		if (!targetSectionId) {
			const sectionResult = await tryCreateSection({
				payload,
				data: {
					course: courseIdNum,
					title: "Default Section",
					description: "Default section for activity modules",
				},
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			if (!sectionResult.ok) {
				await rollbackTransactionIfCreated(payload, transactionInfo);
				return badRequest({ error: "Failed to create section" });
			}

			targetSectionId = sectionResult.value.id;
		}

		const createResult = await tryCreateCourseActivityModuleLink({
			payload,
			req: transactionInfo.reqWithTransaction,
			course: courseIdNum,
			activityModule: formData.activityModuleId,
			section: targetSectionId,
			order: 0,
		});

		if (!createResult.ok) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			return badRequest({ error: createResult.error.message });
		}

		await commitTransactionIfCreated(payload, transactionInfo);
		return ok({
			success: true,
			message: "Activity module linked successfully",
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [deleteAction, useDeleteModuleLink] = createDeleteModuleLinkActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const { courseId } = params;
		const courseIdNum = Number(courseId);

		const authError = await checkAuthorization(context, courseIdNum);
		if (authError) return authError;

		const deleteResult = await tryDeleteCourseActivityModuleLink({
			payload,
			req: payloadRequest,
			linkId: formData.linkId,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		// If redirectTo is provided, return redirect instead of returning response
		if (formData.redirectTo) {
			return redirect(formData.redirectTo);
		}

		return ok({ success: true, message: "Link deleted successfully" });
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

// Export hooks for use in components
export { useCreateModuleLink, useDeleteModuleLink };


const [action] = createActionMap({
	[Action.Create]: createAction,
	[Action.Delete]: deleteAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	} else if (actionData?.status === StatusCode.BadRequest || actionData?.status === StatusCode.Unauthorized) {
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
	const { course, canEdit, availableModules } = loaderData;

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
						description: link.activityModule.description,
					},
					createdAt: link.createdAt,
				}))}
				availableModules={availableModules}
				canEdit={canEdit.allowed}
				courseId={course.id}
			/>
		</Container>
	);
}
