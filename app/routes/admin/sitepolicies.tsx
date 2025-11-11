import { Button, Group, NumberInput, Select, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetSitePolicies,
	tryUpdateSitePolicies,
} from "server/internal/site-policies";
import { z } from "zod";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/sitepolicies";

type SitePoliciesGlobal = {
	id: number;
	userMediaStorageTotal?: number | null;
	siteUploadLimit?: number | null;
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

	const settings = await tryGetSitePolicies({
		payload,
		// ! this is a system request, we don't care about access control
		overrideAccess: true,
	});

	if (!settings.ok) {
		throw new ForbiddenResponse("Failed to get site policies");
	}

	return { settings: settings.value };
}

const inputSchema = z.object({
	userMediaStorageTotal: z.preprocess(
		(val) => {
			if (val === "" || val === null || val === undefined) {
				return null;
			}
			if (typeof val === "string") {
				const num = Number(val);
				return Number.isNaN(num) ? null : num;
			}
			return typeof val === "number" ? val : null;
		},
		z.number().min(0).nullable().optional(),
	),
	siteUploadLimit: z.preprocess(
		(val) => {
			if (val === "" || val === null || val === undefined) {
				return null;
			}
			if (typeof val === "string") {
				const num = Number(val);
				return Number.isNaN(num) ? null : num;
			}
			return typeof val === "number" ? val : null;
		},
		z.number().min(0).nullable().optional(),
	),
});

export async function action({ request, context }: Route.ActionArgs) {
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

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = inputSchema.safeParse(data);
	if (!parsed.success) {
		throw new ForbiddenResponse("Invalid payload");
	}
	const { userMediaStorageTotal, siteUploadLimit } = parsed.data;

	const updateResult = await tryUpdateSitePolicies({
		payload,
		user: currentUser as unknown as import("server/payload-types").User,
		data: {
			userMediaStorageTotal,
			siteUploadLimit,
		},
		overrideAccess: false,
	});

	if (!updateResult.ok) {
		throw new ForbiddenResponse(updateResult.error.message);
	}

	return {
		success: true as const,
		settings: updateResult.value as unknown as SitePoliciesGlobal,
	};
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const res = await serverAction();
	if (res?.success) {
		notifications.show({
			title: "Site policies updated",
			message: "Your changes have been saved.",
			color: "green",
		});
	} else {
		notifications.show({
			title: "Failed to update",
			message: "Unexpected error",
			color: "red",
		});
	}
	return res;
}

export function useUpdateSitePolicies() {
	const fetcher = useFetcher<typeof clientAction>();
	const update = (data: {
		userMediaStorageTotal: number | null;
		siteUploadLimit: number | null;
	}) => {
		const formData = new FormData();
		if (data.userMediaStorageTotal !== null && data.userMediaStorageTotal !== undefined) {
			formData.set("userMediaStorageTotal", String(data.userMediaStorageTotal));
		} else {
			formData.set("userMediaStorageTotal", "");
		}
		if (data.siteUploadLimit !== null && data.siteUploadLimit !== undefined) {
			formData.set("siteUploadLimit", String(data.siteUploadLimit));
		} else {
			formData.set("siteUploadLimit", "");
		}
		fetcher.submit(formData, {
			method: "post",
			action: href("/admin/sitepolicies"),
		});
	};
	return { update, state: fetcher.state } as const;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

// Helper function to format bytes to human-readable format
function formatBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let size = bytes;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}
	return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
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
	const { state, update } = useUpdateSitePolicies();
	const {
		settings: { userMediaStorageTotal, siteUploadLimit },
	} = loaderData;

	// Find matching preset option or use "custom"
	const getStoragePreset = (value: number | null | undefined): string => {
		if (value === null || value === undefined) return "";
		const option = storageOptions.find(
			(opt) => opt.value !== "" && opt.value !== "custom" && Number(opt.value) === value,
		);
		return option ? option.value : "custom";
	};

	const getUploadLimitPreset = (value: number | null | undefined): string => {
		if (value === null || value === undefined) return "";
		const option = uploadLimitOptions.find(
			(opt) => opt.value !== "" && opt.value !== "custom" && Number(opt.value) === value,
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
			<Title order={2}>Site Policies</Title>
			<Text c="dimmed" size="sm">
				Configure media storage limits and upload restrictions for the site.
			</Text>
			<form
				method="post"
				onSubmit={form.onSubmit((values) => {
					update({
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
								const numValue = typeof value === "string" ? Number(value) : value;
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
								const numValue = typeof value === "string" ? Number(value) : value;
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
						<Button type="submit" loading={state !== "idle"}>
							Save changes
						</Button>
					</Group>
				</Stack>
			</form>
		</Stack>
	);
}

