import { Container } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { href, redirect, useFetcher } from "react-router";
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
import { canSeeCourseModules } from "server/utils/permissions";
import { z } from "zod";
import { ActivityModulesSection } from "~/components/activity-modules-section";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.modules";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

enum Action {
	Create = "create",
	Delete = "delete",
}

// Define search params for module link actions
export const moduleLinkSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(moduleLinkSearchParams);

const getActionUrl = (action: Action, courseId: number) => {
	return (
		href("/course/:courseId/modules", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
};

export function useCreateModuleLink() {
	const fetcher = useFetcher<typeof clientAction>();

	const createModuleLink = (
		activityModuleId: number,
		courseId: number,
		sectionId?: number,
	) => {
		fetcher.submit(
			{ activityModuleId, ...(sectionId && { sectionId }) },
			{
				method: "post",
				action: getActionUrl(Action.Create, courseId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		createModuleLink,
		state: fetcher.state,
	};
}

export function useDeleteModuleLink() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteModuleLink = (
		linkId: number,
		courseId: number,
		redirectTo?: string,
	) => {
		fetcher.submit(
			{ linkId, ...(redirectTo && { redirectTo }) },
			{
				method: "post",
				action: getActionUrl(Action.Delete, courseId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		deleteModuleLink,
		state: fetcher.state,
		isLoading: fetcher.state !== "idle",
	};
}

export const loader = async ({ context }: Route.LoaderArgs) => {
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

const createSchema = z.object({
	activityModuleId: z.coerce.number(),
	sectionId: z.coerce.number().optional(),
});

const deleteSchema = z.object({
	linkId: z.coerce.number(),
	redirectTo: z.string().nullish(),
});

const createAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { courseId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

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
					role: enrollment.role,
				}
			: undefined,
	);

	if (!canManage) {
		return unauthorized({
			error: "You don't have permission to manage this course",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = createSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const transactionInfo = await handleTransactionId(
		payload,
		createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	);

	// Use provided section ID or create a default section
	let targetSectionId = parsedData.data.sectionId;

	if (!targetSectionId) {
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: Number(courseId),
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
		course: Number(courseId),
		activityModule: parsedData.data.activityModuleId,
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
};

const deleteAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { courseId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

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
					role: enrollment.role,
				}
			: undefined,
	);

	if (!canManage) {
		return unauthorized({
			error: "You don't have permission to manage this course",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = deleteSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const linkId = parsedData.data.linkId;
	const redirectTo = parsedData.data.redirectTo;

	const deleteResult = await tryDeleteCourseActivityModuleLink({
		payload,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
		linkId,
	});

	if (!deleteResult.ok) {
		return badRequest({ error: deleteResult.error.message });
	}

	// If redirectTo is provided, return redirect instead of returning response
	if (redirectTo) {
		return redirect(redirectTo);
	}

	return ok({ success: true, message: "Link deleted successfully" });
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			error: "Action is required",
		});
	}

	if (actionType === Action.Create) {
		return createAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.Delete) {
		return deleteAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	return badRequest({
		error: "Invalid action",
	});
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
	const { createModuleLink, state: createState } = useCreateModuleLink();
	const { deleteModuleLink, state: deleteState } = useDeleteModuleLink();

	const { course, canEdit, availableModules } = loaderData;

	const fetcherState = createState !== "idle" ? createState : deleteState;

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
				canEdit={canEdit.allowed}
				fetcherState={fetcherState}
				onAddModule={(activityModuleId) =>
					createModuleLink(activityModuleId, course.id)
				}
				onDeleteLink={(linkId) => deleteModuleLink(linkId, course.id)}
			/>
		</Container>
	);
}
