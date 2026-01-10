import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Container,
	Group,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { Link, redirect } from "react-router";
import { createActionMap, typeCreateActionRpc } from "~/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
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
import { getTypeLabel } from "~/utils/course-view-utils";
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
import { getRouteUrl } from "app/utils/search-params-utils";
import { parseAsBoolean } from "nuqs";

enum Action {
	Create = "create",
	Delete = "delete",
}

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/course/:courseId/modules",
});

const createModuleLinkRpc = createActionRpc({
	formDataSchema: z.object({
		activityModuleId: z.coerce.number(),
		sectionId: z.coerce.number().optional(),
	}),
	method: "POST",
	action: Action.Create,
});

const deleteModuleLinkRpc = createActionRpc({
	formDataSchema: z.object({
		linkId: z.coerce.number(),
		redirectTo: z.string().nullish(),
	}),
	method: "POST",
	action: Action.Delete,
});

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loaderSearchParams = {
	reload: parseAsBoolean.withDefault(false),
};

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, searchParams }) => {
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
		searchParams,
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

const createAction = createModuleLinkRpc.createAction(
	async ({ context, formData, params }) => {
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
	},
);

const useCreateModuleLink =
	createModuleLinkRpc.createHook<typeof createAction>();

const deleteAction = deleteModuleLinkRpc.createAction(
	async ({ context, formData, params }) => {
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
	},
);

const useDeleteModuleLink =
	deleteModuleLinkRpc.createHook<typeof deleteAction>();

// Export hooks for use in components
export { useCreateModuleLink, useDeleteModuleLink };

interface ActivityModulesSectionProps {
	existingLinks: Route.ComponentProps["loaderData"]["course"]["moduleLinks"];
	availableModules: Route.ComponentProps["loaderData"]["availableModules"];
	canEdit: boolean;
	courseId: number;
}

interface AddModuleButtonProps {
	availableModules: Route.ComponentProps["loaderData"]["availableModules"];
	courseId: number;
}

function AddModuleButton({ availableModules, courseId }: AddModuleButtonProps) {
	const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
	const { submit: createModuleLink, isLoading: isCreating } =
		useCreateModuleLink();

	const handleAddModule = async () => {
		if (selectedModuleId) {
			await createModuleLink({
				values: {
					activityModuleId: Number.parseInt(selectedModuleId, 10),
				},
				params: { courseId },
			});
			setSelectedModuleId(null);
		}
	};

	return (
		<>
			<Select
				placeholder="Select activity module"
				data={availableModules.map((module) => ({
					value: module.id.toString(),
					label: `${module.title} (${getTypeLabel(module.type)})`,
				}))}
				value={selectedModuleId}
				onChange={setSelectedModuleId}
				disabled={isCreating}
				style={{ minWidth: 300 }}
			/>
			<Button
				leftSection={<IconPlus size={16} />}
				onClick={handleAddModule}
				disabled={isCreating || !selectedModuleId}
			>
				Add Module
			</Button>
		</>
	);
}

interface DeleteModuleButtonProps {
	linkId: number;
	courseId: number;
}

function DeleteModuleButton({ linkId, courseId }: DeleteModuleButtonProps) {
	const { submit: deleteModuleLink, isLoading: isDeleting } =
		useDeleteModuleLink();

	const handleDelete = async () => {
		await deleteModuleLink({
			values: {
				linkId,
			},
			params: { courseId },
		});
	};

	return (
		<ActionIcon
			variant="light"
			color="red"
			size="md"
			aria-label="Delete link"
			onClick={handleDelete}
			disabled={isDeleting}
		>
			<IconTrash size={16} />
		</ActionIcon>
	);
}

function ActivityModulesSection({
	existingLinks,
	availableModules,
	canEdit,
	courseId,
}: ActivityModulesSectionProps) {
	return (
		<Paper withBorder shadow="sm" p="xl" radius="md">
			<Stack gap="lg">
				<Group justify="space-between">
					<Title order={2}>Linked Activity Modules</Title>
					{canEdit && (
						<Group gap="sm">
							{availableModules.length > 0 ? (
								<AddModuleButton
									availableModules={availableModules}
									courseId={courseId}
								/>
							) : (
								<Text size="sm" c="dimmed">
									No available modules to link
								</Text>
							)}
						</Group>
					)}
				</Group>

				{existingLinks.length === 0 ? (
					<Text c="dimmed" ta="center" py="xl">
						No activity modules linked to this course yet.
					</Text>
				) : (
					<Box style={{ overflowX: "auto" }}>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Module Title</Table.Th>
									<Table.Th>Type</Table.Th>
									<Table.Th>Created Date</Table.Th>
									{canEdit && <Table.Th>Actions</Table.Th>}
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{existingLinks.map((link) => (
									<Table.Tr key={link.id}>
										<Table.Td>
											<Text
												fw={500}
												component={Link}
												to={getRouteUrl("/user/modules/:id?", {
													params: { id: link.activityModule.id.toString() },
												})}
											>
												{typeof link.activityModule === "object"
													? link.activityModule.title
													: "Unknown Module"}
											</Text>
										</Table.Td>
										<Table.Td>
											<Badge variant="light">
												{typeof link.activityModule === "object"
													? getTypeLabel(link.activityModule.type)
													: "Unknown"}
											</Badge>
										</Table.Td>
										<Table.Td>
											<Text size="sm" c="dimmed">
												{new Date(link.createdAt).toLocaleDateString()}
											</Text>
										</Table.Td>
										{canEdit && (
											<Table.Td>
												<DeleteModuleButton
													linkId={link.id}
													courseId={courseId}
												/>
											</Table.Td>
										)}
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Box>
				)}
			</Stack>
		</Paper>
	);
}

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
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
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
				existingLinks={course.moduleLinks}
				availableModules={availableModules}
				canEdit={canEdit.allowed}
				courseId={course.id}
			/>
		</Container>
	);
}
