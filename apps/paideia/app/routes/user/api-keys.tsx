import {
	Alert,
	Anchor,
	Button,
	Container,
	CopyButton,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconKey, IconKeyOff } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGenerateApiKey,
	tryGetApiKeyStatus,
	tryRevokeApiKey,
} from "@paideia/paideia-backend";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
} from "app/utils/router/responses";
import type { Route } from "./+types/api-keys";
import {
	createActionMap,
	typeCreateActionRpc,
} from "app/utils/router/action-utils";
import { typeCreateLoader } from "app/utils/router/loader-utils";

enum Action {
	Generate = "generate",
	Revoke = "revoke",
}

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { id } = params;

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	let targetUserId: number;
	if (id !== undefined) {
		if (Number(id) !== currentUser.id && currentUser.role !== "admin") {
			throw new ForbiddenResponse(
				"Only admins can manage other users' API keys",
			);
		}
		targetUserId = Number(id);
	} else {
		targetUserId = currentUser.id;
	}

	const statusResult = await tryGetApiKeyStatus({
		payload,
		userId: targetUserId,
		req: payloadRequest,
	});

	if (!statusResult.ok) {
		throw new NotFoundResponse("User not found");
	}

	return {
		hasApiKey: statusResult.value.hasApiKey,
		params,
	};
})!;

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/api-keys/:id?",
});

const createGenerateActionRpc = createActionRpc({
	method: "POST",
	action: Action.Generate,
});

const createRevokeActionRpc = createActionRpc({
	method: "POST",
	action: Action.Revoke,
});

const generateAction = createGenerateActionRpc.createAction(
	async ({ context, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			throw new NotFoundResponse("Unauthorized");
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		const targetUserId = params.id ? Number(params.id) : currentUser.id;

		if (targetUserId !== currentUser.id && currentUser.role !== "admin") {
			return badRequest({
				error: "Only admins can generate API keys for other users",
			});
		}

		const result = await tryGenerateApiKey({
			payload,
			userId: targetUserId,
			req: payloadRequest,
			overrideAccess: true,
		});

		if (!result.ok) {
			return badRequest({
				error: "Failed to generate API key",
			});
		}

		return ok({
			apiKey: result.value.apiKey,
			success: true,
		});
	},
);

const revokeAction = createRevokeActionRpc.createAction(
	async ({ context, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			throw new NotFoundResponse("Unauthorized");
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		const targetUserId = params.id ? Number(params.id) : currentUser.id;

		if (targetUserId !== currentUser.id && currentUser.role !== "admin") {
			return badRequest({
				error: "Only admins can revoke API keys for other users",
			});
		}

		const result = await tryRevokeApiKey({
			payload,
			userId: targetUserId,
			req: payloadRequest,
			overrideAccess: true,
		});

		if (!result.ok) {
			return badRequest({
				error: "Failed to revoke API key",
			});
		}

		return ok({ success: true });
	},
);

export const useGenerateApiKey =
	createGenerateActionRpc.createHook<typeof generateAction>();
export const useRevokeApiKey =
	createRevokeActionRpc.createHook<typeof revokeAction>();

const [action] = createActionMap({
	[Action.Generate]: generateAction,
	[Action.Revoke]: revokeAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok && actionData?.success) {
		if ("apiKey" in actionData && actionData.apiKey) {
			notifications.show({
				title: "API Key Generated",
				message:
					"Your API key has been created. Copy it now — you won't see it again.",
				color: "green",
			});
		} else {
			notifications.show({
				title: "API Key Revoked",
				message: "Your API key has been revoked successfully.",
				color: "green",
			});
		}
	} else if (
		actionData?.status === StatusCode.BadRequest &&
		actionData?.error
	) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
}

export default function ApiKeysPage({ loaderData }: Route.ComponentProps) {
	const { hasApiKey, params } = loaderData;
	const {
		submit: generate,
		isLoading: isGenerating,
		data: generateData,
	} = useGenerateApiKey();
	const { submit: revoke, isLoading: isRevoking } = useRevokeApiKey();
	const [generatedKey, setGeneratedKey] = useState<string | null>(null);

	useEffect(() => {
		if (
			generateData?.status === StatusCode.Ok &&
			"apiKey" in generateData &&
			generateData.apiKey
		) {
			setGeneratedKey(generateData.apiKey);
		}
	}, [generateData]);

	const handleGenerate = () => {
		generate({
			params: params.id ? { id: params.id } : {},
			values: {},
		});
	};

	const handleRevoke = () => {
		revoke({
			params: params.id ? { id: params.id } : {},
			values: {},
		});
		setGeneratedKey(null);
	};

	const handleCloseKeyModal = () => {
		setGeneratedKey(null);
	};

	return (
		<Container size="md" py="xl">
			<title>API Keys | Paideia LMS</title>
			<meta
				name="description"
				content="Manage your API keys for programmatic access"
			/>
			<meta property="og:title" content="API Keys | Paideia LMS" />
			<meta
				property="og:description"
				content="Manage your API keys for programmatic access"
			/>

			<Stack gap="xl">
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="md">
						API Keys
					</Title>
					<Text size="sm" c="dimmed" mb="lg">
						API keys allow you to authenticate with the Paideia LMS API for
						programmatic access. Each user can have one active API key at a
						time.
					</Text>

					<Alert color="blue" mb="lg" title="API documentation">
						<Text size="sm">
							View the full API reference and try endpoints at{" "}
							<Anchor
								component={Link}
								to="/openapi"
								target="_blank"
								rel="noopener noreferrer"
								inline
							>
								/openapi
							</Anchor>
							. Use your API key in the Authorization header as{" "}
							<code>Bearer pld_...</code>
						</Text>
					</Alert>

					{generatedKey && (
						<Alert mb="lg" color="yellow" title="Copy your API key now">
							<Text size="sm" mb="sm">
								This is the only time you'll see this key. Store it securely —
								it cannot be retrieved again.
							</Text>
							<Group mt="sm" align="flex-start" wrap="wrap">
								<Text
									ff="monospace"
									size="sm"
									style={{
										wordBreak: "break-all",
										userSelect: "all",
										flex: 1,
										minWidth: 200,
									}}
								>
									{generatedKey}
								</Text>
								<CopyButton value={generatedKey} timeout={2000}>
									{({ copied, copy }) => (
										<Button
											color={copied ? "teal" : "blue"}
											variant="light"
											size="sm"
											leftSection={<IconCopy size={16} />}
											onClick={copy}
										>
											{copied ? "Copied" : "Copy"}
										</Button>
									)}
								</CopyButton>
								<Button
									variant="subtle"
									size="sm"
									onClick={handleCloseKeyModal}
								>
									Close
								</Button>
							</Group>
						</Alert>
					)}

					{hasApiKey && !generatedKey ? (
						<Stack gap="md">
							<Alert color="green" title="API key active">
								You have an active API key. Use it in the Authorization header
								as: <code>Bearer pld_...</code>
							</Alert>
							<Button
								color="red"
								variant="light"
								leftSection={<IconKeyOff size={16} />}
								onClick={handleRevoke}
								loading={isRevoking}
							>
								Revoke API Key
							</Button>
						</Stack>
					) : (
						<Button
							leftSection={<IconKey size={16} />}
							onClick={handleGenerate}
							loading={isGenerating}
							disabled={!!generatedKey}
						>
							Generate API Key
						</Button>
					)}
				</Paper>
			</Stack>
		</Container>
	);
}
