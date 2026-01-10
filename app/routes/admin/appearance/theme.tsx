import { Button, Group, Select, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { createActionMap, typeCreateActionRpc } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetAppearanceSettings,
	tryUpdateAppearanceSettings,
} from "server/internal/appearance-settings";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/theme";

type AppearanceGlobal = {
	id: number;
	color?: string;
	radius?: "xs" | "sm" | "md" | "lg" | "xl";
};

const validColors = [
	"blue",
	"pink",
	"indigo",
	"green",
	"orange",
	"gray",
	"grape",
	"cyan",
	"lime",
	"red",
	"violet",
	"teal",
	"yellow",
] as const;

const validRadius = ["xs", "sm", "md", "lg", "xl"] as const;

enum Action {
	Update = "update",
}

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;
	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this area");
	}

	const settings = await tryGetAppearanceSettings({
		payload,
		// ! this is a system request, we don't care about access control
		overrideAccess: true,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to get appearance settings");
	});

	return { settings };
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/appearance/theme",
});

const updateThemeRpc = createActionRpc({
	formDataSchema: z.object({
		color: z.enum([...validColors]).optional(),
		radius: z.enum([...validRadius]).optional(),
	}),
	method: "POST",
	action: Action.Update,
});

const updateThemeAction = updateThemeRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}

		if (currentUser.role !== "admin") {
			return forbidden({
				success: false,
				error: "Only admins can access this area",
			});
		}

		const { color, radius } = formData;

		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: payloadRequest,
			data: {
				color,
				radius: radius as "xs" | "sm" | "md" | "lg" | "xl" | undefined,
			},
			overrideAccess: false,
		});

		if (!updateResult.ok) {
			return badRequest({
				success: false,
				error: updateResult.error.message,
			});
		}

		return ok({
			success: true,
			settings: updateResult.value as unknown as AppearanceGlobal,
		});
	},
);

const useUpdateTheme = updateThemeRpc.createHook<typeof updateThemeAction>();

// Export hook for use in component
export { useUpdateTheme };

const [action] = createActionMap({
	[Action.Update]: updateThemeAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Theme settings updated",
			message: "Your changes have been saved.",
			color: "green",
		});
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized ||
		actionData?.status === StatusCode.Forbidden
	) {
		notifications.show({
			title: "Failed to update",
			message: actionData?.error || "Failed to update theme settings",
			color: "red",
		});
	}

	return actionData;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

export default function AdminTheme({ loaderData }: Route.ComponentProps) {
	const { submit: updateTheme, isLoading } = useUpdateTheme();
	const {
		settings: { color, radius },
	} = loaderData;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			color: color ?? "blue",
			radius: radius ?? "sm",
		},
	});

	return (
		<Stack gap="md" my="lg">
			<title>Theme Settings | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="Configure theme settings including primary color and border radius."
			/>
			<meta
				property="og:title"
				content="Theme Settings | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Configure theme settings including primary color and border radius."
			/>
			<Title order={2}>Theme Settings</Title>

			<form
				onSubmit={form.onSubmit(async (values) => {
					await updateTheme({
						values: {
							color: values.color,
							radius: values.radius,
						},
					});
				})}
			>
				<Stack gap="md">
					{/* Theme Color Selection */}
					<div>
						<Text size="sm" fw={500} mb="xs">
							Primary Color
						</Text>
						<Text c="dimmed" size="sm" mb="sm">
							Select the primary color theme for the application. This affects
							buttons, links, and other interactive elements.
						</Text>
						<Group gap="xs">
							{validColors.map((colorValue) => {
								const isSelected = form.getValues().color === colorValue;
								return (
									<Button
										key={colorValue}
										variant={isSelected ? "filled" : "outline"}
										color={colorValue}
										onClick={() => {
											form.setFieldValue("color", colorValue);
										}}
										style={{
											textTransform: "capitalize",
											minWidth: 80,
										}}
									>
										{colorValue}
									</Button>
								);
							})}
						</Group>
					</div>

					{/* Border Radius Selection */}
					<div>
						<Text size="sm" fw={500} mb="xs">
							Border Radius
						</Text>
						<Text c="dimmed" size="sm" mb="sm">
							Select the default border radius for components. This affects
							buttons, cards, inputs, and other elements.
						</Text>
						<Select
							{...form.getInputProps("radius")}
							key={form.key("radius")}
							data={[
								{ value: "xs", label: "Extra Small" },
								{ value: "sm", label: "Small" },
								{ value: "md", label: "Medium" },
								{ value: "lg", label: "Large" },
								{ value: "xl", label: "Extra Large" },
							]}
							style={{ maxWidth: 300 }}
						/>
					</div>

					<Group justify="flex-start" mt="sm">
						<Button type="submit" loading={isLoading} disabled={isLoading}>
							Save changes
						</Button>
					</Group>
				</Stack>
			</form>
		</Stack>
	);
}
