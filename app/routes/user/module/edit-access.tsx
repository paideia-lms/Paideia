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
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link, useFetcher, useLoaderData } from "react-router";
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
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit-access";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userModuleContext = context.get(userModuleContextKey);

	if (!userModuleContext) {
		throw new NotFoundResponse("Module context not found");
	}

	// Check if user can edit this module
	if (userModuleContext.accessType === "readonly") {
		throw new ForbiddenResponse("You only have read-only access to this module");
	}

	return {
		module: userModuleContext.module,
		links: userModuleContext.links,
		linkedCourses: userModuleContext.linkedCourses,
		grants: userModuleContext.grants,
		instructors: userModuleContext.instructors,
	};
};

const grantAccessSchema = z.object({
	intent: z.literal("grant-access"),
	userId: z.number(),
	notifyPeople: z.boolean(),
});

const revokeAccessSchema = z.object({
	intent: z.literal("revoke-access"),
	userId: z.number(),
});

const actionSchema = z.discriminatedUnion("intent", [
	grantAccessSchema,
	revokeAccessSchema,
]);

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to manage access",
		});
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const moduleId = params.moduleId;
	if (!moduleId) {
		return badRequest({
			success: false,
			error: "Module ID is required",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = actionSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: parsed.error.message,
		});
	}

	if (parsed.data.intent === "grant-access") {
		const grantResult = await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: Number(moduleId),
			grantedToUserId: Number(parsed.data.userId),
			grantedByUserId: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id,
			},
			req: request,
			overrideAccess: false,
		});

		if (!grantResult.ok) {
			return badRequest({
				success: false,
				error: grantResult.error.message,
			});
		}

		return ok({ success: true, message: "Access granted successfully" });
	}

	if (parsed.data.intent === "revoke-access") {
		const revokeResult = await tryRevokeAccessFromActivityModule({
			payload,
			activityModuleId: Number(moduleId),
			userId: Number(parsed.data.userId),
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id,
			},
			req: request,
			overrideAccess: false,
		});

		if (!revokeResult.ok) {
			return badRequest({
				success: false,
				error: revokeResult.error.message,
			});
		}

		return ok({ success: true, message: "Access revoked successfully" });
	}

	return badRequest({
		success: false,
		error: "Invalid action",
	});
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData?.message || "Action completed successfully",
			color: "green",
		});
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

// Custom hook for granting access to activity module
export function useGrantModuleAccess() {
	const fetcher = useFetcher<typeof clientAction>();

	const grantAccess = (userIds: number[], notifyPeople: boolean) => {
		for (const userId of userIds) {
			fetcher.submit(
				{
					intent: "grant-access",
					userId: userId,
					notifyPeople: notifyPeople,
				},
				{
					method: "POST",
					encType: ContentType.JSON,
				},
			);
		}
	};

	return {
		grantAccess,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

// Custom hook for revoking access from activity module
export function useRevokeModuleAccess() {
	const fetcher = useFetcher<typeof clientAction>();

	const revokeAccess = (userId: number) => {
		fetcher.submit(
			{
				intent: "revoke-access",
				userId: userId,
			},
			{
				method: "POST",
				encType: ContentType.JSON,
			},
		);
	};

	return {
		revokeAccess,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
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
											href={href("/course/:id", { id: String(course.id) })}
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
																to={href("/course/module/:id", {
																	id: String(l.id),
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
}: GrantAccessSectionProps) {
	const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
	const [notifyPeople, setNotifyPeople] = useState(false);

	const { grantAccess, isLoading: isGranting } = useGrantModuleAccess();
	const { revokeAccess, isLoading: isRevoking } = useRevokeModuleAccess();
	const isLoading = isGranting || isRevoking;
	const fetcherState = isLoading ? "submitting" : "idle";

	const handleGrantAccess = () => {
		if (selectedUsers.length > 0) {
			grantAccess(
				selectedUsers.map((u) => u.id),
				notifyPeople,
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
											onClick={() => revokeAccess(grant.grantedTo.id)}
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
