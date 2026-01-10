import {
	Anchor,
	Avatar,
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
import { IconUserCheck } from "@tabler/icons-react";
import { href, Link, redirect } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { tryFindUserById } from "server/internal/user-management";
import { setImpersonationCookie } from "~/utils/cookie";
import { z } from "zod";
import {
	badRequest,
	notFound,
	NotFoundResponse,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/profile";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";

enum Action {
	Impersonate = "impersonate",
}

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const userProfileContext = context.get(userProfileContextKey);

	if (!userProfileContext) {
		throw new NotFoundResponse("User profile context not found");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser = userProfileContext.currentUser;

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can edit this profile
	const editPermission = userProfileContext.permissions.canEdit;

	// Check if user can impersonate
	const impersonatePermission = userProfileContext.permissions.canImpersonate;

	return {
		user: userProfileContext.profileUser,
		enrollments: userProfileContext.enrollments,
		isOwnProfile: userId === currentUser.id,
		canEdit: editPermission.allowed,
		canImpersonate: impersonatePermission.allowed,
		params,
	};
})!;

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/profile/:id?",
});

const createImpersonateActionRpc = createActionRpc({
	formDataSchema: z.object({
		redirectTo: z.string().optional(),
	}),
	method: "POST",
	action: Action.Impersonate,
});

const impersonateAction = createImpersonateActionRpc.createAction(
	async ({ context, formData, request, params }) => {
		const { payload, requestInfo, payloadRequest } =
			context.get(globalContextKey);
		const userProfileContext = context.get(userProfileContextKey);

		if (!userProfileContext) {
			return notFound({ error: "User profile context not found" });
		}

		if (!params.id) {
			return badRequest({
				error:
					"Target user ID is required because you are impersonating other users",
			});
		}

		if (params.id === userProfileContext.currentUser.id) {
			return badRequest({ error: "You cannot impersonate yourself" });
		}

		// Verify the target user exists and is not an admin
		const targetUserResult = await tryFindUserById({
			payload,
			userId: params.id,
			req: payloadRequest,
		});

		if (!targetUserResult.ok) {
			return badRequest({ error: "Target user not found" });
		}

		const targetUser = targetUserResult.value;
		if (targetUser.role === "admin") {
			return badRequest({ error: "Cannot impersonate admin users" });
		}

		// Get redirect URL from data, default to "/"
		const redirectTo = formData.redirectTo || "/";

		// Set impersonation cookie and redirect
		return redirect(redirectTo, {
			headers: {
				"Set-Cookie": setImpersonationCookie(
					params.id,
					requestInfo.domainUrl,
					request.headers,
					payload,
				),
			},
		});
	},
);

export const useImpersonate =
	createImpersonateActionRpc.createHook<typeof impersonateAction>();

const [action] = createActionMap({
	[Action.Impersonate]: impersonateAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	// Impersonation actions redirect, so no notification needed

	return actionData;
}

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
	const { user, enrollments, isOwnProfile, canEdit, canImpersonate } =
		loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const { submit: impersonate, isLoading } = useImpersonate();

	// Sort enrollments: active first, then by enrolledAt date (newest first)
	const sortedEnrollments = [...enrollments].sort((a, b) => {
		// Active enrollments first
		if (a.status === "active" && b.status !== "active") return -1;
		if (a.status !== "active" && b.status === "active") return 1;
		// Then sort by enrolledAt (newest first)
		const dateA = a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0;
		const dateB = b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0;
		return dateB - dateA;
	});

	return (
		<Container size="md" py="xl">
			<title>{`${fullName} | Profile | Paideia LMS`}</title>
			<meta
				name="description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} profile information`}
			/>
			<meta
				property="og:title"
				content={`${fullName} | Profile | Paideia LMS`}
			/>
			<meta
				property="og:description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} profile information`}
			/>

			<Stack gap="xl">
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Stack align="center" gap="lg">
						<Avatar
							src={user.avatarUrl}
							alt={fullName}
							size={120}
							radius={120}
						/>
						<div style={{ textAlign: "center" }}>
							<Title order={2} mb="xs">
								{fullName}
							</Title>
							{isOwnProfile && (
								<Text size="sm" c="dimmed" mb="md">
									Your Profile
								</Text>
							)}
						</div>
						{user.bio && (
							<div style={{ width: "100%" }}>
								<Text size="sm" fw={600} mb="xs">
									Bio
								</Text>
								<Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
									{user.bio}
								</Text>
							</div>
						)}
						<Group gap="md" w="100%">
							{canEdit && (
								<Button
									component={Link}
									to={href("/user/overview/:id?", {
										id: user.id.toString(),
									})}
									variant="light"
								>
									Edit Profile
								</Button>
							)}
							{canImpersonate && (
								<Button
									variant="light"
									color="orange"
									onClick={() =>
										impersonate({
											params: {
												id: user.id,
											},
											values: {},
										})
									}
									loading={isLoading}
									leftSection={<IconUserCheck size={16} />}
								>
									Impersonate User
								</Button>
							)}
						</Group>
					</Stack>
				</Paper>

				{/* Activity Modules Section */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Group justify="space-between" align="center">
						<div>
							<Title order={3} mb="xs">
								Activity Modules
							</Title>
							<Text size="sm" c="dimmed">
								View {isOwnProfile ? "your" : "their"} activity modules
							</Text>
						</div>
						<Button
							component={Link}
							to={isOwnProfile ? "/user/modules" : `/user/modules/${user.id}`}
							variant="light"
						>
							View Modules
						</Button>
					</Group>
				</Paper>

				{/* Courses Section */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Stack gap="md">
						<div>
							<Title order={3} mb="xs">
								Courses
							</Title>
							<Text size="sm" c="dimmed">
								{isOwnProfile ? "Your" : "Their"} course enrollments
							</Text>
						</div>
						{sortedEnrollments.length > 0 ? (
							<Stack gap="xs">
								{sortedEnrollments.map((enrollment) => {
									const isActive = enrollment.status === "active";
									const courseLink = href("/course/:courseId", {
										courseId: enrollment.course.id.toString(),
									});

									return (
										<Group
											key={enrollment.id}
											justify="space-between"
											align="center"
											wrap="nowrap"
										>
											<Group gap="sm" style={{ flex: 1 }} wrap="nowrap">
												<Anchor
													component={Link}
													to={courseLink}
													size="sm"
													c={isActive ? undefined : "dimmed"}
													style={{
														textDecoration: isActive ? undefined : "none",
													}}
												>
													{enrollment.course.title}
												</Anchor>
												<Badge
													size="sm"
													variant="light"
													color={
														enrollment.status === "active"
															? "green"
															: enrollment.status === "completed"
																? "blue"
																: enrollment.status === "dropped"
																	? "red"
																	: "gray"
													}
												>
													{enrollment.status === "active"
														? "Active"
														: enrollment.status === "completed"
															? "Completed"
															: enrollment.status === "dropped"
																? "Dropped"
																: "Inactive"}
												</Badge>
												{enrollment.role !== "student" && (
													<Badge size="sm" variant="outline" color="grape">
														{enrollment.role === "teacher"
															? "Teacher"
															: enrollment.role === "ta"
																? "TA"
																: "Manager"}
													</Badge>
												)}
											</Group>
										</Group>
									);
								})}
							</Stack>
						) : (
							<Text size="sm" c="dimmed">
								No course enrollments
							</Text>
						)}
					</Stack>
				</Paper>

				{/* Notes Link */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Group justify="space-between" align="center">
						<div>
							<Title order={3} mb="xs">
								Notes
							</Title>
							<Text size="sm" c="dimmed">
								View {isOwnProfile ? "your" : "their"} notes and activity
							</Text>
						</div>
						<Button
							component={Link}
							to={isOwnProfile ? "/user/notes" : `/user/notes/${user.id}`}
							variant="light"
						>
							View Notes
						</Button>
					</Group>
				</Paper>
			</Stack>
		</Container>
	);
}
