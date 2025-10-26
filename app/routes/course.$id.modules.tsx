import { Container } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
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
import { ContentType, getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { z } from "zod";

export function useCreateModuleLink() {
	const fetcher = useFetcher<typeof clientAction>();

	const createModuleLink = (
		activityModuleId: number,
		courseId: number,
		sectionId?: number,
	) => {
		fetcher.submit(
			{ intent: "create", activityModuleId, ...(sectionId && { sectionId }) },
			{ method: "post", action: href("/course/:id/modules", { id: courseId.toString() }), encType: ContentType.JSON },
		);
	};

	return {
		createModuleLink,
		state: fetcher.state,
	};
}

function useDeleteModuleLink() {
	const fetcher = useFetcher<typeof action>();

	const deleteModuleLink = (linkId: number, courseId: number) => {
		fetcher.submit(
			{ intent: "delete", linkId },
			{ method: "post", action: href("/course/:id/modules", { id: courseId.toString() }), encType: ContentType.JSON },
		);
	};

	return {
		deleteModuleLink,
		state: fetcher.state,
	};
}

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

const createSchema = z.object({
	intent: z.literal("create"),
	activityModuleId: z.coerce.number(),
	sectionId: z.coerce.number().optional(),
});

const deleteSchema = z.object({
	intent: z.literal("delete"),
	linkId: z.coerce.number(),
});

const inputSchema = z.discriminatedUnion("intent", [createSchema, deleteSchema]);

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

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsedData = inputSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	if (parsedData.data.intent === "create") {
		// Start transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			return badRequest({ error: "Failed to begin transaction" });
		}

		try {
			// Use provided section ID or create a default section
			let targetSectionId = parsedData.data.sectionId;

			if (!targetSectionId) {
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

				targetSectionId = sectionResult.value.id;
			}

			const createResult = await tryCreateCourseActivityModuleLink(
				payload,
				request,
				{
					course: courseId,
					activityModule: parsedData.data.activityModuleId,
					section: targetSectionId,
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

	if (parsedData.data.intent === "delete") {
		const linkId = parsedData.data.linkId;

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
				canEdit={canEdit}
				fetcherState={fetcherState}
				onAddModule={(activityModuleId) => createModuleLink(activityModuleId, course.id)}
				onDeleteLink={(linkId) => deleteModuleLink(linkId, course.id)}
			/>
		</Container>
	);
}
