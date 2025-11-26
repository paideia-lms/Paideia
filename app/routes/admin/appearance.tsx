import {
	ActionIcon,
	Button,
	Group,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
	IconArrowDown,
	IconArrowUp,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetAppearanceSettings,
	tryUpdateAppearanceSettings,
} from "server/internal/appearance-settings";
import { z } from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/appearance";

type AppearanceGlobal = {
	id: number;
	additionalCssStylesheets?: Array<{ url: string }>;
};

export async function loader({ context }: Route.LoaderArgs) {
	const { payload } = context.get(globalContextKey);
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
	});

	if (!settings.ok) {
		throw new ForbiddenResponse("Failed to get appearance settings");
	}

	return { settings: settings.value };
}

const inputSchema = z.object({
	additionalCssStylesheets: z
		.array(
			z.object({
				url: z.string().url("Must be a valid URL"),
			}),
		)
		.optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;
	if (currentUser.role !== "admin") {
		return forbidden({ error: "Only admins can access this area" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsed = inputSchema.safeParse(data);
	if (!parsed.success) {
		return badRequest({ error: z.prettifyError(parsed.error) });
	}
	const { additionalCssStylesheets } = parsed.data;

	const updateResult = await tryUpdateAppearanceSettings({
		payload,
		user: currentUser,
		data: {
			additionalCssStylesheets,
		},
		overrideAccess: false,
	});

	if (!updateResult.ok) {
		return forbidden({ error: updateResult.error.message });
	}

	return ok({
		success: true as const,
		settings: updateResult.value as unknown as AppearanceGlobal,
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const res = await serverAction();
	if (res?.status === 200) {
		notifications.show({
			title: "Appearance settings updated",
			message: "Your changes have been saved.",
			color: "green",
		});
	} else {
		notifications.show({
			title: "Failed to update",
			message: typeof res?.error === "string" ? res.error : "Unexpected error",
			color: "red",
		});
	}
	return res;
}

export function useUpdateAppearanceSettings() {
	const fetcher = useFetcher<typeof clientAction>();
	const update = (data: {
		additionalCssStylesheets: Array<{ url: string }>;
	}) => {
		fetcher.submit(data, {
			method: "post",
			action: href("/admin/appearance"),
			encType: "application/json",
		});
	};
	return { update, state: fetcher.state } as const;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

export default function AdminAppearance({ loaderData }: Route.ComponentProps) {
	const { state, update } = useUpdateAppearanceSettings();
	const {
		settings: { additionalCssStylesheets },
	} = loaderData;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			stylesheets: additionalCssStylesheets.map((sheet) => ({
				url: sheet.url,
			})),
		},
	});

	const stylesheets = form.getValues().stylesheets;

	const addStylesheet = () => {
		form.insertListItem("stylesheets", { url: "" });
	};

	const removeStylesheet = (index: number) => {
		form.removeListItem("stylesheets", index);
	};

	const moveStylesheet = (index: number, direction: "up" | "down") => {
		if (direction === "up" && index > 0) {
			const item = stylesheets[index]!;
			form.removeListItem("stylesheets", index);
			form.insertListItem("stylesheets", item, index - 1);
		} else if (direction === "down" && index < stylesheets.length - 1) {
			const item = stylesheets[index]!;
			form.removeListItem("stylesheets", index);
			form.insertListItem("stylesheets", item, index + 1);
		}
	};

	return (
		<Stack gap="md" my="lg">
			<title>Additional CSS Stylesheets | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="Add external CSS stylesheet URLs that will be loaded on all pages. Stylesheets are loaded in the order listed, allowing you to control CSS cascade precedence. Only HTTP and HTTPS URLs are supported."
			/>
			<meta
				property="og:title"
				content="Additional CSS Stylesheets | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Add external CSS stylesheet URLs that will be loaded on all pages. Stylesheets are loaded in the order listed, allowing you to control CSS cascade precedence. Only HTTP and HTTPS URLs are supported."
			/>
			<Title order={2}>Additional CSS Stylesheets</Title>
			<Text c="dimmed" size="sm">
				Add external CSS stylesheet URLs that will be loaded on all pages.
				Stylesheets are loaded in the order listed, allowing you to control CSS
				cascade precedence. Only HTTP and HTTPS URLs are supported.
			</Text>
			<form
				method="post"
				onSubmit={form.onSubmit((values) => {
					// Filter out empty URLs
					const validStylesheets = values.stylesheets.filter(
						(sheet) => sheet.url && sheet.url.trim() !== "",
					);
					update({
						additionalCssStylesheets: validStylesheets,
					});
				})}
			>
				<Stack gap="sm">
					{stylesheets.map(({ url }, index) => (
						<Group
							key={`${url}-${
								// biome-ignore lint/suspicious/noArrayIndexKey: url may not be unique, index is needed
								index
							}`}
							align="flex-start"
							wrap="nowrap"
						>
							<TextInput
								{...form.getInputProps(`stylesheets.${index}.url`)}
								key={form.key(`stylesheets.${index}.url`)}
								placeholder="https://example.com/style.css"
								style={{ flex: 1 }}
								error={
									form.getValues().stylesheets[index]?.url &&
									!form
										.getValues()
										.stylesheets[index]?.url.match(/^https?:\/\/.+/)
										? "Must be a valid HTTP or HTTPS URL"
										: undefined
								}
							/>
							<Group gap="xs" wrap="nowrap">
								<ActionIcon
									variant="subtle"
									onClick={() => moveStylesheet(index, "up")}
									disabled={index === 0}
									aria-label="Move up"
								>
									<IconArrowUp size={16} />
								</ActionIcon>
								<ActionIcon
									variant="subtle"
									onClick={() => moveStylesheet(index, "down")}
									disabled={index === stylesheets.length - 1}
									aria-label="Move down"
								>
									<IconArrowDown size={16} />
								</ActionIcon>
								<ActionIcon
									variant="subtle"
									color="red"
									onClick={() => removeStylesheet(index)}
									aria-label="Remove"
								>
									<IconTrash size={16} />
								</ActionIcon>
							</Group>
						</Group>
					))}
					<Button
						leftSection={<IconPlus size={16} />}
						variant="light"
						onClick={addStylesheet}
						type="button"
					>
						Add Stylesheet
					</Button>
					{stylesheets.length === 0 && (
						<Text c="dimmed" size="sm" ta="center" py="md">
							No stylesheets configured. Click "Add Stylesheet" to add one.
						</Text>
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
