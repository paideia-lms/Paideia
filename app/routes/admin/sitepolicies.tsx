import {
	Button,
	Group,
	NumberInput,
	Select,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetSitePolicies,
	tryUpdateSitePolicies,
} from "server/internal/site-policies";
import { z } from "zod";
import {
	ForbiddenResponse,
	forbidden,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/sitepolicies";

type SitePoliciesGlobal = {
	id: number;
	userMediaStorageTotal?: number | null;
	siteUploadLimit?: number | null;
};

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

	const settings = await tryGetSitePolicies({
		payload,
		req: payloadRequest,
	});

	if (!settings.ok) {
		throw new ForbiddenResponse("Failed to get site policies");
	}

	return { settings: settings.value };
}

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const formDataSchema = z.object({
	userMediaStorageTotal: z.preprocess((val) => {
		if (val === "" || val === null || val === undefined) {
			return null;
		}
		if (typeof val === "string") {
			const num = Number(val);
			return Number.isNaN(num) ? null : num;
		}
		return typeof val === "number" ? val : null;
	}, z.number().min(0).nullable().optional()),
	siteUploadLimit: z.preprocess((val) => {
		if (val === "" || val === null || val === undefined) {
			return null;
		}
		if (typeof val === "string") {
			const num = Number(val);
			return Number.isNaN(num) ? null : num;
		}
		return typeof val === "number" ? val : null;
	}, z.number().min(0).nullable().optional()),
});

const createUpdateSitePoliciesActionRpc = createActionRpc({
	formDataSchema,
	method: "POST",
});

const getRouteUrl = () => {
	return href("/admin/sitepolicies");
};

const [updateSitePoliciesAction, useUpdateSitePolicies] =
	createUpdateSitePoliciesActionRpc(
		serverOnly$(async ({ context, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);
			const userSession = context.get(userContextKey);
			if (!userSession?.isAuthenticated) {
				return unauthorized({ error: "Unauthorized" });
			}
			const currentUser =
				userSession.effectiveUser ?? userSession.authenticatedUser;
			if (currentUser.role !== "admin") {
				return forbidden({ error: "Only admins can access this area" });
			}

			const updateResult = await tryUpdateSitePolicies({
				payload,
				req: payloadRequest,
				data: {
					userMediaStorageTotal: formData.userMediaStorageTotal,
					siteUploadLimit: formData.siteUploadLimit,
				},
			});

			if (!updateResult.ok) {
				return forbidden({ error: updateResult.error.message });
			}

			return ok({
				success: true as const,
				settings: updateResult.value as unknown as SitePoliciesGlobal,
			});
		})!,
		{
			action: getRouteUrl,
		},
	);

// Export hook for use in components
export { useUpdateSitePolicies };

export const action = updateSitePoliciesAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const res = await serverAction();
	if (res?.status === 200) {
		notifications.show({
			title: "Site policies updated",
			message: "Your changes have been saved.",
			color: "green",
		});
	} else {
		const errorMessage =
			typeof res?.error === "string" ? res.error : "Unexpected error";
		notifications.show({
			title: "Failed to update",
			message: errorMessage,
			color: "red",
		});
	}
	return res;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

// Storage options (in bytes)
const storageOptions = [
	{ value: "", label: "Unlimited" },
	{ value: String(100 * 1024 * 1024), label: "100 MB" },
	{ value: String(500 * 1024 * 1024), label: "500 MB" },
	{ value: String(1024 * 1024 * 1024), label: "1 GB" },
	{ value: String(5 * 1024 * 1024 * 1024), label: "5 GB" },
	{ value: String(10 * 1024 * 1024 * 1024), label: "10 GB" },
	{ value: String(50 * 1024 * 1024 * 1024), label: "50 GB" },
	{ value: String(100 * 1024 * 1024 * 1024), label: "100 GB" },
	{ value: "custom", label: "Custom..." },
];

// Upload limit options (in bytes)
const uploadLimitOptions = [
	{ value: "", label: "Unlimited" },
	{ value: String(1 * 1024 * 1024), label: "1 MB" },
	{ value: String(5 * 1024 * 1024), label: "5 MB" },
	{ value: String(10 * 1024 * 1024), label: "10 MB" },
	{ value: String(20 * 1024 * 1024), label: "20 MB" },
	{ value: String(50 * 1024 * 1024), label: "50 MB" },
	{ value: String(100 * 1024 * 1024), label: "100 MB" },
	{ value: String(500 * 1024 * 1024), label: "500 MB" },
	{ value: String(1024 * 1024 * 1024), label: "1 GB" },
	{ value: "custom", label: "Custom..." },
];

export default function AdminSitePolicies({
	loaderData,
}: Route.ComponentProps) {
	const { submit: update, isLoading } = useUpdateSitePolicies();
	const {
		settings: { userMediaStorageTotal, siteUploadLimit },
	} = loaderData;

	// Find matching preset option or use "custom"
	const getStoragePreset = (value: number | null | undefined): string => {
		if (value === null || value === undefined) return "";
		const option = storageOptions.find(
			(opt) =>
				opt.value !== "" &&
				opt.value !== "custom" &&
				Number(opt.value) === value,
		);
		return option ? option.value : "custom";
	};

	const getUploadLimitPreset = (value: number | null | undefined): string => {
		if (value === null || value === undefined) return "";
		const option = uploadLimitOptions.find(
			(opt) =>
				opt.value !== "" &&
				opt.value !== "custom" &&
				Number(opt.value) === value,
		);
		return option ? option.value : "custom";
	};

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			userMediaStorageTotal: userMediaStorageTotal ?? undefined,
			siteUploadLimit: siteUploadLimit ?? undefined,
			userMediaStorageTotalPreset: getStoragePreset(userMediaStorageTotal),
			siteUploadLimitPreset: getUploadLimitPreset(siteUploadLimit),
		},
	});

	return (
		<Stack gap="md" my="lg">
			<title>Site Policies | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="Configure media storage limits and upload restrictions"
			/>
			<meta property="og:title" content="Site Policies | Admin | Paideia LMS" />
			<meta
				property="og:description"
				content="Configure media storage limits and upload restrictions"
			/>
			<Title order={2}>Site Policies</Title>
			<Text c="dimmed" size="sm">
				Configure media storage limits and upload restrictions for the site.
			</Text>
			<form
				method="post"
				onSubmit={form.onSubmit((values) => {
					update({
						values: {
							userMediaStorageTotal:
								values.userMediaStorageTotal !== undefined &&
								values.userMediaStorageTotal !== null
									? values.userMediaStorageTotal
									: null,
							siteUploadLimit:
								values.siteUploadLimit !== undefined &&
								values.siteUploadLimit !== null
									? values.siteUploadLimit
									: null,
						},
					});
				})}
			>
				<Stack gap="sm">
					<Select
						{...form.getInputProps("userMediaStorageTotalPreset")}
						key={form.key("userMediaStorageTotalPreset")}
						label="User Media Storage Total"
						description="Quick select a preset value or choose 'Custom...' to enter a specific value"
						placeholder="Select a preset"
						data={storageOptions}
						clearable={false}
						allowDeselect={false}
						onChange={(value) => {
							if (value === "" || value === null) {
								form.setFieldValue("userMediaStorageTotal", undefined);
							} else if (value === "custom") {
								// Keep current custom value
							} else {
								form.setFieldValue("userMediaStorageTotal", Number(value));
							}
							form.setFieldValue("userMediaStorageTotalPreset", value ?? "");
						}}
					/>
					{form.getValues().userMediaStorageTotalPreset === "custom" && (
						<NumberInput
							{...form.getInputProps("userMediaStorageTotal")}
							key={form.key("userMediaStorageTotal")}
							label="Custom User Media Storage Total (bytes)"
							description="Enter a custom storage limit in bytes"
							placeholder="Enter bytes"
							min={0}
							allowDecimal={false}
							onChange={(value) => {
								const numValue =
									typeof value === "string" ? Number(value) : value;
								form.setFieldValue("userMediaStorageTotal", numValue);
								// Check if value matches a preset
								const preset = getStoragePreset(numValue);
								if (preset !== "custom") {
									form.setFieldValue("userMediaStorageTotalPreset", preset);
								}
							}}
						/>
					)}

					<Select
						{...form.getInputProps("siteUploadLimitPreset")}
						key={form.key("siteUploadLimitPreset")}
						label="Site Upload Limit"
						description="Quick select a preset value or choose 'Custom...' to enter a specific value"
						placeholder="Select a preset"
						data={uploadLimitOptions}
						clearable={false}
						allowDeselect={false}
						onChange={(value) => {
							if (value === "" || value === null) {
								form.setFieldValue("siteUploadLimit", undefined);
							} else if (value === "custom") {
								// Keep current custom value
							} else {
								form.setFieldValue("siteUploadLimit", Number(value));
							}
							form.setFieldValue("siteUploadLimitPreset", value ?? "");
						}}
					/>
					{form.getValues().siteUploadLimitPreset === "custom" && (
						<NumberInput
							{...form.getInputProps("siteUploadLimit")}
							key={form.key("siteUploadLimit")}
							label="Custom Site Upload Limit (bytes)"
							description="Enter a custom upload limit in bytes"
							placeholder="Enter bytes"
							min={0}
							allowDecimal={false}
							onChange={(value) => {
								const numValue =
									typeof value === "string" ? Number(value) : value;
								form.setFieldValue("siteUploadLimit", numValue);
								// Check if value matches a preset
								const preset = getUploadLimitPreset(numValue);
								if (preset !== "custom") {
									form.setFieldValue("siteUploadLimitPreset", preset);
								}
							}}
						/>
					)}

					<Group justify="flex-start" mt="sm">
						<Button type="submit" loading={isLoading}>
							Save changes
						</Button>
					</Group>
				</Stack>
			</form>
		</Stack>
	);
}
