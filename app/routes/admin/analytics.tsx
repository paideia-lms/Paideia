import {
	ActionIcon,
	Button,
	Checkbox,
	Group,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
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
	tryGetAnalyticsSettings,
	tryUpdateAnalyticsSettings,
} from "server/internal/analytics-settings";
import { z } from "zod";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/analytics";

type AnalyticsGlobal = {
	id: number;
	additionalJsScripts?: Array<{
		src: string;
		defer?: boolean;
		async?: boolean;
		dataWebsiteId?: string;
		dataDomain?: string;
		dataSite?: string;
		dataMeasurementId?: string;
	}>;
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

	const settings = await tryGetAnalyticsSettings({
		payload,
		// ! this is a system request, we don't care about access control
		overrideAccess: true,
	});

	if (!settings.ok) {
		throw new ForbiddenResponse("Failed to get analytics settings");
	}

	const scripts =
		settings?.value?.additionalJsScripts?.map((script) => ({
			src: script.src,
			defer: script.defer ?? false,
			async: script.async ?? false,
			dataWebsiteId: script.dataWebsiteId ?? "",
			dataDomain: script.dataDomain ?? "",
			dataSite: script.dataSite ?? "",
			dataMeasurementId: script.dataMeasurementId ?? "",
		})) ?? [];

	return { settings: { additionalJsScripts: scripts } };
}

const inputSchema = z.object({
	additionalJsScripts: z
		.array(
			z.object({
				src: z.url("Must be a valid URL"),
				defer: z.boolean().optional(),
				async: z.boolean().optional(),
				dataWebsiteId: z.string().optional(),
				dataDomain: z.string().optional(),
				dataSite: z.string().optional(),
				dataMeasurementId: z.string().optional(),
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
	const { additionalJsScripts } = parsed.data;

	const updateResult = await tryUpdateAnalyticsSettings({
		payload,
		user: currentUser,
		data: {
			additionalJsScripts,
		},
		req: request,
		overrideAccess: false,
	});

	if (!updateResult.ok) {
		return forbidden({ error: updateResult.error.message });
	}

	return ok({
		success: true as const,
		settings: updateResult.value as unknown as AnalyticsGlobal,
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const res = await serverAction();
	if (res?.status === 200) {
		notifications.show({
			title: "Analytics settings updated",
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

export function useUpdateAnalyticsSettings() {
	const fetcher = useFetcher<typeof clientAction>();
	const update = (data: {
		additionalJsScripts: Array<{
			src: string;
			defer?: boolean;
			async?: boolean;
			dataWebsiteId?: string;
			dataDomain?: string;
			dataSite?: string;
			dataMeasurementId?: string;
		}>;
	}) => {
		fetcher.submit(data, {
			method: "post",
			action: href("/admin/analytics"),
			encType: "application/json",
		});
	};
	return { update, state: fetcher.state } as const;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

interface AnalyticsScriptCardProps {
	form: UseFormReturnType<{
		scripts: Array<{
			src: string;
			defer: boolean;
			async: boolean;
			dataWebsiteId: string;
			dataDomain: string;
			dataSite: string;
			dataMeasurementId: string;
		}>;
	}>;
	index: number;
	totalScripts: number;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove: () => void;
}

function AnalyticsScriptCard({
	form,
	index,
	totalScripts,
	onMoveUp,
	onMoveDown,
	onRemove,
}: AnalyticsScriptCardProps) {
	return (
		<Stack
			key={form.key(`scripts.${index}.src`)}
			gap="sm"
			p="md"
			style={{
				border: "1px solid var(--mantine-color-gray-3)",
				borderRadius: "var(--mantine-radius-sm)",
			}}
		>
			<Group justify="space-between" align="flex-start">
				<Text fw={500}>Script {index + 1}</Text>
				<Group gap="xs" wrap="nowrap">
					<ActionIcon
						variant="subtle"
						onClick={onMoveUp}
						disabled={index === 0}
						aria-label="Move up"
					>
						<IconArrowUp size={16} />
					</ActionIcon>
					<ActionIcon
						variant="subtle"
						onClick={onMoveDown}
						disabled={index === totalScripts - 1}
						aria-label="Move down"
					>
						<IconArrowDown size={16} />
					</ActionIcon>
					<ActionIcon
						variant="subtle"
						color="red"
						onClick={onRemove}
						aria-label="Remove"
					>
						<IconTrash size={16} />
					</ActionIcon>
				</Group>
			</Group>
			<TextInput
				{...form.getInputProps(`scripts.${index}.src`)}
				key={form.key(`scripts.${index}.src`)}
				label="Script URL"
				placeholder="https://cloud.umami.is/script.js"
				required
				error={
					form.getValues().scripts[index]?.src &&
					!form.getValues().scripts[index]?.src.match(/^https?:\/\/.+/)
						? "Must be a valid HTTP or HTTPS URL"
						: undefined
				}
			/>
			<Group>
				<Checkbox
					{...form.getInputProps(`scripts.${index}.defer`, {
						type: "checkbox",
					})}
					key={form.key(`scripts.${index}.defer`)}
					label="Defer"
				/>
				<Checkbox
					{...form.getInputProps(`scripts.${index}.async`, {
						type: "checkbox",
					})}
					key={form.key(`scripts.${index}.async`)}
					label="Async"
				/>
			</Group>
			<TextInput
				{...form.getInputProps(`scripts.${index}.dataWebsiteId`)}
				key={form.key(`scripts.${index}.dataWebsiteId`)}
				label="Data Website ID (for Umami)"
				placeholder="63b7582a-1ce5-46fd-8635-612cbba6cd1c"
			/>
			<TextInput
				{...form.getInputProps(`scripts.${index}.dataDomain`)}
				key={form.key(`scripts.${index}.dataDomain`)}
				label="Data Domain (for Plausible)"
				placeholder="example.com"
			/>
			<TextInput
				{...form.getInputProps(`scripts.${index}.dataSite`)}
				key={form.key(`scripts.${index}.dataSite`)}
				label="Data Site (for Fathom)"
				placeholder="ABCDEFGH"
			/>
			<TextInput
				{...form.getInputProps(`scripts.${index}.dataMeasurementId`)}
				key={form.key(`scripts.${index}.dataMeasurementId`)}
				label="Data Measurement ID (for Google Analytics)"
				placeholder="G-XXXXXXXXXX"
			/>
		</Stack>
	);
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
	const { state, update } = useUpdateAnalyticsSettings();
	const {
		settings: { additionalJsScripts },
	} = loaderData;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			scripts: additionalJsScripts.map((script) => ({
				src: script.src,
				defer: script.defer ?? false,
				async: script.async ?? false,
				dataWebsiteId: script.dataWebsiteId ?? "",
				dataDomain: script.dataDomain ?? "",
				dataSite: script.dataSite ?? "",
				dataMeasurementId: script.dataMeasurementId ?? "",
			})),
		},
	});

	const scripts =
		useFormWatchForceUpdate(form, "scripts", ({ previousValue, value }) => {
			// Force update when scripts array changes (length or content)
			const oldScripts = (previousValue || []).map(
				(s: {
					src: string;
					defer: boolean;
					async: boolean;
					dataWebsiteId: string;
					dataDomain: string;
					dataSite: string;
					dataMeasurementId: string;
				}) => ({
					src: s.src,
					defer: s.defer,
					async: s.async,
					dataWebsiteId: s.dataWebsiteId,
					dataDomain: s.dataDomain,
					dataSite: s.dataSite,
					dataMeasurementId: s.dataMeasurementId,
				}),
			);
			const newScripts = (value || []).map(
				(s: {
					src: string;
					defer: boolean;
					async: boolean;
					dataWebsiteId: string;
					dataDomain: string;
					dataSite: string;
					dataMeasurementId: string;
				}) => ({
					src: s.src,
					defer: s.defer,
					async: s.async,
					dataWebsiteId: s.dataWebsiteId,
					dataDomain: s.dataDomain,
					dataSite: s.dataSite,
					dataMeasurementId: s.dataMeasurementId,
				}),
			);
			return JSON.stringify(oldScripts) !== JSON.stringify(newScripts);
		}) || [];

	const addScript = () => {
		form.insertListItem("scripts", {
			src: "",
			defer: false,
			async: false,
			dataWebsiteId: "",
			dataDomain: "",
			dataSite: "",
			dataMeasurementId: "",
		});
	};

	const removeScript = (index: number) => {
		form.removeListItem("scripts", index);
	};

	const moveScript = (index: number, direction: "up" | "down") => {
		if (direction === "up" && index > 0) {
			const item = scripts[index]!;
			form.removeListItem("scripts", index);
			form.insertListItem("scripts", item, index - 1);
		} else if (direction === "down" && index < scripts.length - 1) {
			const item = scripts[index]!;
			form.removeListItem("scripts", index);
			form.insertListItem("scripts", item, index + 1);
		}
	};

	return (
		<Stack gap="md" my="lg">
			<title>Analytics Scripts | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="Add external JavaScript script tags that will be loaded on all pages. Scripts are loaded in the order listed. Only external scripts with src attribute are allowed for security. Common analytics providers include Plausible, Umami, Google Analytics, and Fathom."
			/>
			<meta
				property="og:title"
				content="Analytics Scripts | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Add external JavaScript script tags that will be loaded on all pages. Scripts are loaded in the order listed. Only external scripts with src attribute are allowed for security. Common analytics providers include Plausible, Umami, Google Analytics, and Fathom."
			/>
			<Title order={2}>Analytics Scripts</Title>
			<Text c="dimmed" size="sm">
				Add external JavaScript script tags that will be loaded on all pages.
				Scripts are loaded in the order listed. Only external scripts with src
				attribute are allowed for security. Common analytics providers include
				Plausible, Umami, Google Analytics, and Fathom.
			</Text>
			<form
				method="post"
				onSubmit={form.onSubmit((values) => {
					// Filter out empty scripts and clean up empty data attributes
					const validScripts = values.scripts
						.filter(
							(script: {
								src: string;
								defer: boolean;
								async: boolean;
								dataWebsiteId: string;
								dataDomain: string;
								dataSite: string;
								dataMeasurementId: string;
							}) => script.src && script.src.trim() !== "",
						)
						.map(
							(script: {
								src: string;
								defer: boolean;
								async: boolean;
								dataWebsiteId: string;
								dataDomain: string;
								dataSite: string;
								dataMeasurementId: string;
							}) => ({
								src: script.src,
								defer: script.defer || undefined,
								async: script.async || undefined,
								dataWebsiteId:
									script.dataWebsiteId && script.dataWebsiteId.trim() !== ""
										? script.dataWebsiteId
										: undefined,
								dataDomain:
									script.dataDomain && script.dataDomain.trim() !== ""
										? script.dataDomain
										: undefined,
								dataSite:
									script.dataSite && script.dataSite.trim() !== ""
										? script.dataSite
										: undefined,
								dataMeasurementId:
									script.dataMeasurementId &&
									script.dataMeasurementId.trim() !== ""
										? script.dataMeasurementId
										: undefined,
							}),
						);
					update({
						additionalJsScripts: validScripts,
					});
				})}
			>
				<Stack gap="md">
					{scripts.map((_script, index: number) => (
						<AnalyticsScriptCard
							key={form.key(`scripts.${index}.src`)}
							form={form}
							index={index}
							totalScripts={scripts.length}
							onMoveUp={() => moveScript(index, "up")}
							onMoveDown={() => moveScript(index, "down")}
							onRemove={() => removeScript(index)}
						/>
					))}
					<Button
						leftSection={<IconPlus size={16} />}
						variant="light"
						onClick={addScript}
						type="button"
					>
						Add Script
					</Button>
					{scripts.length === 0 && (
						<Text c="dimmed" size="sm" ta="center" py="md">
							No scripts configured. Click "Add Script" to add one.
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
