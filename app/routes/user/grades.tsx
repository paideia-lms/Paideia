import { Alert, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { typeCreateLoader } from "app/utils/loader-utils";
import { ForbiddenResponse, NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/grades";

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context, params }) => {
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

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own data");
	}

	return {
		user: {
			id: userProfileContext.profileUser.id,
			firstName: userProfileContext.profileUser.firstName,
			lastName: userProfileContext.profileUser.lastName,
		},
		isOwnData: userId === currentUser.id,
		params,
	};
})!;

export default function UserGradesPage({ loaderData }: Route.ComponentProps) {
	const { user, isOwnData } = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";

	return (
		<Container size="lg" py="xl">
			<title>{`${fullName} | Grades | Paideia LMS`}</title>
			<meta
				name="description"
				content={`View ${isOwnData ? "your" : fullName + "'s"} grades`}
			/>
			<meta
				property="og:title"
				content={`${fullName} | Grades | Paideia LMS`}
			/>
			<meta
				property="og:description"
				content={`View ${isOwnData ? "your" : fullName + "'s"} grades`}
			/>

			<Stack gap="xl">
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="md">
						{isOwnData ? "Your Grades" : `${fullName}'s Grades`}
					</Title>

					<Alert
						variant="light"
						color="blue"
						title="Coming Soon"
						icon={<IconInfoCircle />}
					>
						<Text size="sm">
							The grades feature is currently under development. You will be
							able to view {isOwnData ? "your" : "this user's"} grades across
							all enrolled courses here.
						</Text>
					</Alert>
				</Paper>
			</Stack>
		</Container>
	);
}
