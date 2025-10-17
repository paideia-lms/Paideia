import {
	Badge,
	Button,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit } from "@tabler/icons-react";
import { Link, useFetcher } from "react-router";
import type { Enrollment as CourseEnrollment } from "server/contexts/course-context";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateCourseActivityModuleLink,
	tryDeleteCourseActivityModuleLink,
} from "server/internal/course-activity-module-link-management";
import { tryCreateSection } from "server/internal/course-section-management";
import type { Enrollment } from "server/payload-types";
import { ActivityModulesSection } from "~/components/activity-modules-section";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "~/components/course-view-utils";
import {
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

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({
			error: "Invalid course ID",
		});
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
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

	// Get course to check ownership
	const course = await payload.findByID({
		collection: "courses",
		id: courseId,
		user: currentUser,
		req: request,
		overrideAccess: false,
	});

	if (!course) {
		return badRequest({ error: "Course not found" });
	}

	// Check if user has management access to this course
	const courseCreatedById =
		typeof course.createdBy === "number"
			? course.createdBy
			: course.createdBy.id;

	const canManage =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		courseCreatedById === currentUser.id;

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

	if ("error" in loaderData) {
		return (
			<Container size="lg" py="xl">
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Text c="red">{loaderData.error}</Text>
				</Paper>
			</Container>
		);
	}

	const { course, currentUser, availableModules } = loaderData;

	const canEdit =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		course.enrollments.some(
			(enrollment) => enrollment.userId === currentUser.id,
		);

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

	return (
		<Container size="lg" py="xl">
			<title>{`${course.title} - Modules | Paideia LMS`}</title>
			<meta name="description" content={`${course.title} modules management`} />
			<meta
				property="og:title"
				content={`${course.title} - Modules | Paideia LMS`}
			/>
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
