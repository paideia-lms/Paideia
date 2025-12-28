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
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useQueryState } from "nuqs";
import { createLoader, parseAsInteger } from "nuqs/server";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { permissions } from "server/utils/permissions";
import {
	getEnrollmentStatusBadgeColor,
	getEnrollmentStatusLabel,
	getEnrolmentRoleBadgeColor,
	getRoleLabel,
} from "~/components/course-view-utils";
import { useImpersonate } from "~/routes/user/profile";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.participants.profile";
import { stringify } from "qs";

export type { Route };

// Define search params for user selection
export const profileSearchParams = {
	userId: parseAsInteger,
};

export const loadSearchParams = createLoader(profileSearchParams);

export function getRouteUrl(courseId: number, userId?: number) {
	return (
		href("/course/:courseId/participants/profile", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ userId })
	);
}

export const loader = async ({
	request,
	context,
	params,
}: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);
	const { courseId } = params;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Get selected user from search params
	const { userId } = loadSearchParams(request);

	// Check if user can impersonate the selected user
	// Note: We assume enrolled users are not admins (admins don't need course enrollment)
	const canImpersonate = userId
		? permissions.admin.canImpersonateUser(
			userSession.authenticatedUser,
			{
				id: userId,
				role: "student", // Enrolled users are not admins
			},
			userSession.isImpersonating,
		).allowed
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
	const { submit: impersonate, isLoading } = useImpersonate();

	// Redirect back to the course page after impersonation
	const redirectPath = href("/course/:courseId", {
		courseId: String(course.id),
	});
	const [selectedUserId, setSelectedUserId] = useQueryState(
		"userId",
		parseAsInteger.withOptions({
			shallow: false,
		}),
	);

	// Find selected enrollment
	const selectedEnrollment = selectedUserId
		? course.enrollments.find((e) => e.user.id === selectedUserId)
		: undefined;

	// Prepare user select options
	const userOptions = course.enrollments.map((enrollment) => ({
		value: enrollment.user.id.toString(),
		label: enrollment.user.firstName + " " + enrollment.user.lastName,
	}));

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
										id: selectedEnrollment.user.id.toString(),
									})}
								>
									View Public Profile
								</Button>
								{canImpersonate && (
									<Button
										variant="light"
										color="orange"
										onClick={() =>
											impersonate({
												params: { id: selectedEnrollment.user.id },
												values: { redirectTo: redirectPath },
											})
										}
										loading={isLoading}
										leftSection={<IconUserCheck size={16} />}
									>
										Impersonate User
									</Button>
								)}
							</Group>
							<Avatar
								src={
									selectedEnrollment.user.avatar
										? href(`/api/media/file/:filenameOrId`, {
											filenameOrId: selectedEnrollment.user.avatar.toString(),
										})
										: undefined
								}
								alt={
									selectedEnrollment.user.firstName +
									" " +
									selectedEnrollment.user.lastName
								}
								size={120}
								radius={120}
							/>
							<div style={{ textAlign: "center" }}>
								<Title order={2} mb="xs">
									{selectedEnrollment.user.firstName +
										" " +
										selectedEnrollment.user.lastName}
								</Title>
								<Text size="sm" c="dimmed">
									{selectedEnrollment.user.email}
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
										color={getEnrolmentRoleBadgeColor(selectedEnrollment.role)}
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
