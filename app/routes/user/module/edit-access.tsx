import {
	Badge,
	Button,
	Checkbox,
	Container,
	List,
	Paper,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link, useLoaderData } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import type { Instructor } from "server/contexts/user-module-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	tryGrantAccessToActivityModule,
	tryRevokeAccessFromActivityModule,
} from "server/internal/activity-module-access";
import { z } from "zod";
import type { SearchUser } from "~/routes/api/search-users";
import { SearchUserCombobox } from "~/routes/api/search-users";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit-access";
import { typeCreateActionRpc } from "app/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";

enum Action {
	GrantAccess = "grantAccess",
	RevokeAccess = "revokeAccess",
}

// Define search params for access actions
export const accessSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(accessSearchParams);

export function getRouteUrl(action: Action, moduleId: string) {
	return (
		href("/user/module/edit/:moduleId/access", {
			moduleId,
		}) +
		"?" +
		stringify({ action })
	);
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userModuleContext = context.get(userModuleContextKey);

	if (!userModuleContext) {
		throw new NotFoundResponse("Module context not found");
	}

	// Check if user can edit this module
	if (userModuleContext.accessType === "readonly") {
		throw new ForbiddenResponse(
			"You only have read-only access to this module",
		);
	}

	return {
		module: userModuleContext.module,
		links: userModuleContext.links,
		linkedCourses: userModuleContext.linkedCourses,
		grants: userModuleContext.grants,
		instructors: userModuleContext.instructors,
	};
};

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createGrantAccessActionRpc = createActionRpc({
	formDataSchema: z.object({
		userId: z.coerce.number(),
		notifyPeople: z.coerce.boolean(),
	}),
	method: "POST",
	action: Action.GrantAccess,
});

const createRevokeAccessActionRpc = createActionRpc({
	formDataSchema: z.object({
		userId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.RevokeAccess,
});

const [grantAccessAction, useGrantAccess] = createGrantAccessActionRpc(
	serverOnly$(async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in to manage access",
			});
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;


		const grantResult = await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: params.moduleId,
			grantedToUserId: formData.userId,
			grantedByUserId: currentUser.id,
			req: payloadRequest,
		});

		if (!grantResult.ok) {
			return badRequest({
				success: false,
				error: grantResult.error.message,
			});
		}

		return ok({ success: true, message: "Access granted successfully" });
	})!,
	{
		action: ({ params, searchParams }) =>
			getRouteUrl(searchParams.action, String(params.moduleId)),
	},
);

const [revokeAccessAction, useRevokeAccess] = createRevokeAccessActionRpc(
	serverOnly$(async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const revokeResult = await tryRevokeAccessFromActivityModule({
			payload,
			activityModuleId: params.moduleId,
			userId: formData.userId,
			req: payloadRequest,
		});

		if (!revokeResult.ok) {
			return badRequest({
				success: false,
				error: revokeResult.error.message,
			});
		}

		return ok({ success: true, message: "Access revoked successfully" });
	})!,
	{
		action: ({ params, searchParams }) =>
			getRouteUrl(searchParams.action, String(params.moduleId)),
	},
);

const actionMap = {
	[Action.GrantAccess]: grantAccessAction,
	[Action.RevokeAccess]: revokeAccessAction,
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			success: false,
			error: "Action is required",
		});
	}

	return actionMap[actionType](args);
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

// Linked Courses Section Component
interface LinkedCourse {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
}

interface CourseLink {
	id: number;
	course: {
		id: number;
		title: string;
		slug: string;
	};
	activityModule: {
		id: number;
		title: string;
	};
	sectionTitle?: string | null;
}

interface LinkedCoursesSectionProps {
	links: CourseLink[];
	linkedCourses: LinkedCourse[];
}

function LinkedCoursesSection({
	links,
	linkedCourses,
}: LinkedCoursesSectionProps) {
	return (
		<Paper withBorder shadow="md" p="xl" radius="md">
			<Title order={3} mb="lg">
				Linked Courses
			</Title>
			{links.length === 0 ? (
				<Text c="dimmed" ta="center" py="xl">
					This module is not linked to any courses yet.
				</Text>
			) : (
				<Table.ScrollContainer minWidth={600}>
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Course Name</Table.Th>
								<Table.Th>Course Slug</Table.Th>
								<Table.Th>Usage</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{linkedCourses.map((course) => (
								<Table.Tr key={course.id}>
									<Table.Td>
										<Text
											component="a"
											href={href("/course/:courseId", {
												courseId: String(course.id),
											})}
											fw={500}
											style={{ textDecoration: "none" }}
										>
											{course.title}
										</Text>
									</Table.Td>
									<Table.Td>
										<Text size="sm" c="dimmed">
											{course.slug}
										</Text>
									</Table.Td>
									<Table.Td>
										<List>
											{links
												.filter((l) => l.course.id === course.id)
												.map((l) => {
													return (
														<List.Item key={l.id}>
															<Text
																component={Link}
																to={href("/course/module/:moduleLinkId", {
																	moduleLinkId: String(l.id),
																})}
																fw={500}
															>
																{l.sectionTitle ?? "--"}
															</Text>
														</List.Item>
													);
												})}
										</List>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</Table.ScrollContainer>
			)}
		</Paper>
	);
}

export default function UserModuleEditAccess() {
	const { module, linkedCourses, links, grants, instructors } =
		useLoaderData<typeof loader>();

	// Calculate exclude user IDs
	const grantedUserIds = grants.map((g) => g.grantedTo.id);
	const instructorIds = instructors.map((i) => i.id);
	const ownerId = module.owner.id;
	const excludeUserIds = [ownerId, ...grantedUserIds, ...instructorIds];

	const title = `Access Control | ${module.title} | Paideia LMS`;
	return (
		<Container size="md" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content="Manage access control for activity module in Paideia LMS"
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content="Manage access control for activity module in Paideia LMS"
			/>

			<Stack gap="xl">
				{/* Linked Courses Section */}
				<LinkedCoursesSection links={links} linkedCourses={linkedCourses} />

				{/* User Access Section */}
				<GrantAccessSection
					grants={grants}
					instructors={instructors}
					excludeUserIds={excludeUserIds}
					moduleId={String(module.id)}
				/>
			</Stack>
		</Container>
	);
}

interface GrantedUser {
	id: number;
	grantedTo: {
		id: number;
		email: string;
		firstName?: string | null;
		lastName?: string | null;
	};
	grantedAt: string;
}

interface GrantAccessSectionProps {
	grants: GrantedUser[];
	instructors: Instructor[];
	excludeUserIds?: number[];
}

export function GrantAccessSection({
	grants,
	instructors,
	excludeUserIds = [],
	moduleId,
}: GrantAccessSectionProps & { moduleId: string }) {
	const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
	const [notifyPeople, setNotifyPeople] = useState(false);

	const { submit: grantAccess, isLoading: isGranting } = useGrantAccess();
	const { submit: revokeAccess, isLoading: isRevoking } = useRevokeAccess();
	const isLoading = isGranting || isRevoking;
	const fetcherState = isLoading ? "submitting" : "idle";

	const handleGrantAccess = async () => {
		if (selectedUsers.length > 0) {
			await Promise.all(
				selectedUsers.map((u) =>
					grantAccess({
						params: { moduleId: Number(moduleId) },
						values: {
							userId: u.id,
							notifyPeople,
						},
					}),
				),
			);
			setSelectedUsers([]);
			setNotifyPeople(false);
		}
	};

	const getDisplayName = (user: {
		firstName?: string | null;
		lastName?: string | null;
		email: string;
	}) => {
		const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
		return fullName || user.email;
	};

	return (
		<Paper withBorder shadow="md" p="xl" radius="md">
			<Title order={3} mb="lg">
				User Access
			</Title>

			<Stack gap="md" mb="xl">
				<SearchUserCombobox
					value={selectedUsers}
					onChange={setSelectedUsers}
					placeholder="Search users to grant access..."
					excludeUserIds={excludeUserIds}
					disabled={fetcherState === "submitting"}
				/>

				<Checkbox
					label="Notify people"
					checked={notifyPeople}
					onChange={(event) => setNotifyPeople(event.currentTarget.checked)}
					disabled={fetcherState === "submitting"}
				/>

				<Button
					onClick={handleGrantAccess}
					disabled={selectedUsers.length === 0 || fetcherState === "submitting"}
					loading={fetcherState === "submitting"}
				>
					Grant Access
				</Button>
			</Stack>

			<Title order={4} mb="md">
				Users with Access
			</Title>

			{grants.length === 0 && instructors.length === 0 ? (
				<Text c="dimmed" ta="center" py="xl">
					No users have access yet.
				</Text>
			) : (
				<Table.ScrollContainer minWidth={600}>
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>Access Type</Table.Th>
								<Table.Th>Grant Date / Source</Table.Th>
								<Table.Th>Action</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{/* Edit Access Users */}
							{grants.map((grant) => (
								<Table.Tr key={`grant-${grant.id}`}>
									<Table.Td>
										<Text
											fw={500}
											component={Link}
											to={href("/user/profile/:id?", {
												id: String(grant.grantedTo.id),
											})}
										>
											{getDisplayName(grant.grantedTo)}
										</Text>
										<Text size="sm" c="dimmed">
											{grant.grantedTo.email}
										</Text>
									</Table.Td>
									<Table.Td>
										<Badge color="blue">Edit Access</Badge>
									</Table.Td>
									<Table.Td>
										<Text size="sm">
											{new Date(grant.grantedAt).toLocaleDateString()}
										</Text>
									</Table.Td>
									<Table.Td>
										<Button
											variant="subtle"
											color="red"
											size="xs"
											leftSection={<IconTrash size={14} />}
											onClick={() =>
												revokeAccess({
													params: { moduleId: Number(moduleId) },
													values: {
														userId: grant.grantedTo.id,
													},
												})
											}
											loading={fetcherState === "submitting"}
										>
											Remove
										</Button>
									</Table.Td>
								</Table.Tr>
							))}

							{/* Read-Only Instructors */}
							{instructors.map((instructor) => (
								<Table.Tr key={`instructor-${instructor.id}`}>
									<Table.Td>
										<Text
											fw={500}
											component={Link}
											to={href("/user/profile/:id?", {
												id: String(instructor.id),
											})}
										>
											{getDisplayName(instructor)}
										</Text>
										<Text size="sm" c="dimmed">
											{instructor.email}
										</Text>
									</Table.Td>
									<Table.Td>
										<Badge color="gray">Read Only</Badge>
									</Table.Td>
									<Table.Td>
										<Text size="sm" c="dimmed">
											Instructor in {instructor.enrollments.length} linked
											course
											{instructor.enrollments.length !== 1 ? "s" : ""}
										</Text>
									</Table.Td>
									<Table.Td>
										<Text size="sm" c="dimmed">
											Auto-granted
										</Text>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</Table.ScrollContainer>
			)}
		</Paper>
	);
}
