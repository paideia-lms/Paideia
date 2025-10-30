import {
	Avatar,
	Badge,
	Button,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconUserCheck } from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { createLoader, parseAsInteger } from "nuqs/server";
import { href, Link } from "react-router";
import type { Enrollment } from "server/contexts/course-context";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { canImpersonateUser } from "server/utils/permissions";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import {
	getEnrollmentStatusBadgeColor,
	getEnrollmentStatusLabel,
	getRoleBadgeColor,
	getRoleLabel,
} from "~/components/course-view-utils";
import { useImpersonate } from "~/routes/user/profile";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.participants.profile";

// Define search params for user selection
export const profileSearchParams = {
	userId: parseAsInteger,
};

export const loadSearchParams = createLoader(profileSearchParams);

export const loader = async ({
	request,
	context,
	params,
}: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new BadRequestResponse("Invalid course ID");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Get selected user from search params
	const { userId } = loadSearchParams(request);

	// Check if user can impersonate the selected user
	// Note: We assume enrolled users are not admins (admins don't need course enrollment)
	const canImpersonate = userId
		? canImpersonateUser(
				userSession.authenticatedUser,
				{
					id: userId,
					role: "student", // Enrolled users are not admins
				},
				userSession.isImpersonating,
			)
		: false;

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		currentUser: currentUser,
		selectedUserId: userId,
		canImpersonate,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseParticipantsProfilePage({
	loaderData,
}: Route.ComponentProps) {
	const {
		course,
		selectedUserId: _selectedUserId,
		canImpersonate,
	} = loaderData;
	const { impersonate, isLoading } = useImpersonate();

	// Redirect back to the course page after impersonation
	const redirectPath = href("/course/:id", { id: course.id.toString() });
	const [selectedUserId, setSelectedUserId] = useQueryState(
		"userId",
		parseAsInteger.withOptions({
			shallow: false,
		}),
	);

	// Find selected enrollment
	const selectedEnrollment: Enrollment | undefined = selectedUserId
		? course.enrollments.find((e) => e.userId === selectedUserId)
		: undefined;

	// Prepare user select options
	const userOptions = course.enrollments.map((enrollment) => ({
		value: enrollment.userId.toString(),
		label: enrollment.name || enrollment.email,
	}));

	// Get avatar URL
	const getAvatarUrl = (enrollment: Enrollment) => {
		if (!enrollment.avatar) return undefined;
		const avatarId =
			typeof enrollment.avatar === "object"
				? enrollment.avatar.id
				: enrollment.avatar;
		return `/api/media/file/${avatarId}`;
	};

	return (
		<Stack gap="lg">
			<Paper withBorder shadow="sm" p="lg" radius="md">
				<Stack gap="md">
					<Title order={3}>User Profile</Title>
					<Select
						label="Select User"
						placeholder="Choose a user to view their profile"
						data={userOptions}
						value={selectedUserId?.toString() || null}
						onChange={(value) => {
							setSelectedUserId(value ? Number(value) : null);
						}}
						searchable
						clearable
					/>
				</Stack>
			</Paper>

			{!selectedEnrollment && (
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Text c="dimmed" ta="center">
						Select a user from the dropdown above to view their profile and
						enrollment details.
					</Text>
				</Paper>
			)}

			{selectedEnrollment && (
				<>
					{/* Profile Section */}
					<Paper withBorder shadow="sm" p="xl" radius="md">
						<Stack align="center" gap="lg">
							<Group justify="flex-end" w="100%">
								<Button
									component={Link}
									to={href("/user/profile/:id?", {
										id: selectedEnrollment.userId.toString(),
									})}
								>
									View Public Profile
								</Button>
								{canImpersonate && (
									<Button
										variant="light"
										color="orange"
										onClick={() =>
											impersonate(selectedEnrollment.userId, redirectPath)
										}
										loading={isLoading}
										leftSection={<IconUserCheck size={16} />}
									>
										Impersonate User
									</Button>
								)}
							</Group>
							<Avatar
								src={getAvatarUrl(selectedEnrollment)}
								alt={selectedEnrollment.name}
								size={120}
								radius={120}
							/>
							<div style={{ textAlign: "center" }}>
								<Title order={2} mb="xs">
									{selectedEnrollment.name || "Unknown"}
								</Title>
								<Text size="sm" c="dimmed">
									{selectedEnrollment.email}
								</Text>
							</div>
						</Stack>
					</Paper>

					{/* Enrollment Details Section */}
					<Paper withBorder shadow="sm" p="xl" radius="md">
						<Stack gap="lg">
							<Title order={3}>Enrollment Details</Title>

							<Group gap="lg">
								<div>
									<Text size="sm" fw={600} mb="xs">
										Role
									</Text>
									<Badge
										color={getRoleBadgeColor(selectedEnrollment.role)}
										variant="light"
										size="lg"
									>
										{getRoleLabel(selectedEnrollment.role)}
									</Badge>
								</div>

								<div>
									<Text size="sm" fw={600} mb="xs">
										Status
									</Text>
									<Badge
										color={getEnrollmentStatusBadgeColor(
											selectedEnrollment.status,
										)}
										size="lg"
									>
										{getEnrollmentStatusLabel(selectedEnrollment.status)}
									</Badge>
								</div>
							</Group>

							{selectedEnrollment.groups.length > 0 && (
								<div>
									<Text size="sm" fw={600} mb="xs">
										Groups
									</Text>
									<Group gap="xs">
										{selectedEnrollment.groups.map((group) => (
											<Badge
												key={group.id}
												size="md"
												styles={{
													root: {
														"--badge-bg": group.color || undefined,
													},
												}}
											>
												{group.name}
											</Badge>
										))}
									</Group>
								</div>
							)}

							{selectedEnrollment.enrolledAt && (
								<div>
									<Text size="sm" fw={600} mb="xs">
										Enrolled Date
									</Text>
									<Text size="sm">
										{new Date(selectedEnrollment.enrolledAt).toLocaleDateString(
											"en-US",
											{
												year: "numeric",
												month: "long",
												day: "numeric",
											},
										)}
									</Text>
								</div>
							)}

							{selectedEnrollment.completedAt && (
								<div>
									<Text size="sm" fw={600} mb="xs">
										Completion Date
									</Text>
									<Text size="sm">
										{new Date(
											selectedEnrollment.completedAt,
										).toLocaleDateString("en-US", {
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</Text>
								</div>
							)}
						</Stack>
					</Paper>
				</>
			)}
		</Stack>
	);
}
