import { Button, Group, Stack, Switch, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetRegistrationSettings,
	tryUpdateRegistrationSettings,
} from "server/internal/registration-settings";
import { z } from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
	forbidden,
	ForbiddenResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/registration";

export function getRouteUrl() {
	return href("/admin/registration");
}

export async function loader({ context }: Route.LoaderArgs) {
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

	const settings = await tryGetRegistrationSettings({
		payload,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to get registration settings");
	});

	return { settings };
}

const inputSchema = z.object({
	disableRegistration: z.preprocess((val) => {
		if (typeof val === "string") {
			return val === "true";
		}
		return Boolean(val);
	}, z.boolean().optional()),
	showRegistrationButton: z.preprocess((val) => {
		if (typeof val === "string") {
			return val === "true";
		}
		return Boolean(val);
	}, z.boolean().optional()),
});

export async function action({ request, context }: Route.ActionArgs) {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		return forbidden({ error: "Unauthorized" });
	}
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;
	if (currentUser.role !== "admin") {
		return forbidden({ error: "Only admins can access this area" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = inputSchema.safeParse(data);
	if (!parsed.success) {
		return forbidden({ error: "Invalid payload" });
	}
	const { disableRegistration, showRegistrationButton } = parsed.data;

	const updateResult = await tryUpdateRegistrationSettings({
		payload,
		req: payloadRequest,
		data: {
			disableRegistration,
			showRegistrationButton,
		},
		overrideAccess: false,
	});

	if (!updateResult.ok) {
		return forbidden({ error: updateResult.error.message });
	}

	return ok({
		success: true as const,
		settings: updateResult.value,
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const res = await serverAction();
	if (res?.status === StatusCode.Ok) {
		notifications.show({
			title: "Registration settings updated",
			message: "Your changes have been saved.",
			color: "green",
		});
	} else if (res?.status === StatusCode.Forbidden) {
		notifications.show({
			title: "Failed to update",
			message: res?.error || "Failed to update registration settings",
			color: "red",
		});
	}
	return res;
}

export function useUpdateRegistrationConfig() {
	const fetcher = useFetcher<typeof clientAction>();

	const update = (data: {
		disableRegistration: boolean;
		showRegistrationButton: boolean;
	}) => {
		const formData = new FormData();
		formData.set(
			"disableRegistration",
			data.disableRegistration ? "true" : "false",
		);
		formData.set(
			"showRegistrationButton",
			data.showRegistrationButton ? "true" : "false",
		);
		fetcher.submit(formData, {
			method: "post",
			action: href("/admin/registration"),
		});
	};
	return { update, state: fetcher.state } as const;
}

export default function AdminRegistration({
	loaderData,
}: Route.ComponentProps) {
	const { state, update } = useUpdateRegistrationConfig();
	const {
		settings: { disableRegistration, showRegistrationButton },
	} = loaderData;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			disableRegistration,
			showRegistrationButton,
		},
	});
	return (
		<Stack gap="md" my="lg">
			<title>Registration Settings | Admin | Paideia LMS</title>
			<meta name="description" content="Configure user registration settings" />
			<meta
				property="og:title"
				content="Registration Settings | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Configure user registration settings"
			/>
			{/* <pre>
                {JSON.stringify(loaderData, null, 2)}
            </pre> */}
			<Title order={2}>Registration</Title>
			<form
				method="post"
				onSubmit={form.onSubmit((values) => {
					console.log("onSubmit", values);
					update({
						disableRegistration: values.disableRegistration ?? false,
						showRegistrationButton: values.showRegistrationButton ?? false,
					});
				})}
			>
				<Stack gap="sm">
					<Switch
						{...form.getInputProps("disableRegistration", { type: "checkbox" })}
						key={form.key("disableRegistration")}
						label="Disable Self-Registration"
					/>
					{!form.values.disableRegistration && (
						<Switch
							{...form.getInputProps("showRegistrationButton", {
								type: "checkbox",
							})}
							key={form.key("showRegistrationButton")}
							label="Show Registration Button"
						/>
					)}
					<Group justify="flex-start" mt="sm">
						<Button type="submit" loading={state !== "idle"}>
							Save changes
						</Button>
					</Group>
				</Stack>
			</form>
		</Stack>
	);
}
