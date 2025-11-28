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
import { href, Link, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { tryFindUserById } from "server/internal/user-management";
import { canEditProfile, canImpersonate } from "server/utils/permissions";
import { setImpersonationCookie } from "~/utils/cookie";
import {
	badRequest,
	NotFoundResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/profile";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const userProfileContext = context.get(userProfileContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	if (!userProfileContext) {
		throw new NotFoundResponse("User profile context not found");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can edit this profile
	const editPermission = canEditProfile(currentUser, userId);

	// Check if user can impersonate
	const impersonatePermission = canImpersonate(
		userSession.authenticatedUser,
		userId,
		userProfileContext.profileUser.role,
		userSession.isImpersonating,
	);

	return {
		user: userProfileContext.profileUser,
		enrollments: userProfileContext.enrollments,
		isOwnProfile: userId === currentUser.id,
		canEdit: editPermission.allowed,
		canImpersonate: impersonatePermission.allowed,
		isImpersonating: userSession.isImpersonating,
		authenticatedUser: userSession.authenticatedUser,
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload, requestInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { authenticatedUser: currentUser } = userSession;

	const formData = await request.formData();
	const intent = formData.get("intent");

	// Handle impersonation actions
	if (intent === "impersonate") {
		if (currentUser.role !== "admin") {
			return unauthorized({ error: "Only admins can impersonate users" });
		}

		const targetUserId = Number(formData.get("targetUserId"));
		if (Number.isNaN(targetUserId)) {
			return badRequest({ error: "Invalid target user ID" });
		}

		// Verify the target user exists and is not an admin
		const targetUserResult = await tryFindUserById({
			payload,
			userId: targetUserId,
			req: createLocalReq({
				request,
				user: currentUser,
				context: { routerContext: context },
			}),
			overrideAccess: false,
		});

		if (!targetUserResult.ok) {
			return badRequest({ error: "Target user not found" });
		}

		const targetUser = targetUserResult.value;
		if (targetUser.role === "admin") {
			return badRequest({ error: "Cannot impersonate admin users" });
		}

		// Get redirect URL from form data, default to "/"
		const redirectTo = (formData.get("redirectTo") as string) || "/";

		// Set impersonation cookie and redirect
		throw redirect(redirectTo, {
			headers: {
				"Set-Cookie": setImpersonationCookie(
					targetUserId,
					requestInfo.domainUrl,
					request.headers,
					payload,
				),
			},
		});
	}

	// No other actions supported on profile page
	return badRequest({ error: "Invalid action" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	// Impersonation actions redirect, so no notification needed

	return actionData;
}

// Reusable hook for impersonation functionality
export const useImpersonate = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const impersonate = (targetUserId: number, redirectTo?: string) => {
		const formData = new FormData();
		formData.append("intent", "impersonate");
		formData.append("targetUserId", String(targetUserId));
		if (redirectTo) {
			formData.append("redirectTo", redirectTo);
		}
		// Submit to profile route action which handles impersonation
		fetcher.submit(formData, {
			method: "POST",
			action: href("/user/profile/:id?", { id: targetUserId.toString() }),
		});
	};

	return {
		impersonate,
		isLoading: fetcher.state === "submitting",
		fetcher,
	};
};

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
	const { user, enrollments, isOwnProfile, canEdit, canImpersonate } =
		loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const { impersonate, isLoading } = useImpersonate();

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
									onClick={() => impersonate(user.id)}
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
