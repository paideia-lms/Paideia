import { os } from "@orpc/server";
import { z } from "zod";
import { tryGetAnalyticsSettings, tryUpdateAnalyticsSettings } from "../../internal/analytics-settings";
import { tryGetAppearanceSettings, tryUpdateAppearanceSettings } from "../../internal/appearance-settings";
import { tryGetMaintenanceSettings, tryUpdateMaintenanceSettings } from "../../internal/maintenance-settings";
import { tryGetRegistrationSettings, tryUpdateRegistrationSettings } from "../../internal/registration-settings";
import { tryGetSitePolicies, tryUpdateSitePolicies } from "../../internal/site-policies";
import type { OrpcContext } from "../context";
import { run } from "../utils/handler";

const outputSchema = z.any();

const analyticsUpdateSchema = z.object({
	data: z.object({
		additionalJsScripts: z
			.array(z.object({ src: z.string(), defer: z.boolean().optional() }))
			.optional(),
	}),
});

const appearanceUpdateSchema = z.object({
	data: z
		.object({
			additionalCssStylesheets: z.array(z.string()).optional(),
			color: z.enum(["blue", "pink", "indigo", "green", "orange", "gray", "grape", "cyan", "lime", "red", "violet", "teal", "yellow"]).optional(),
			radius: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
		})
		.optional(),
});

const maintenanceUpdateSchema = z.object({
	data: z.object({ maintenanceMode: z.boolean().optional() }),
});

const registrationUpdateSchema = z.object({
	data: z.object({
		disableRegistration: z.boolean().optional(),
		showRegistrationButton: z.boolean().optional(),
	}),
});

const sitePoliciesUpdateSchema = z.object({
	data: z.object({
		userMediaStorageTotal: z.number().nullable().optional(),
		siteUploadLimit: z.number().nullable().optional(),
	}),
});

export const getAnalyticsSettings = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/settings/analytics" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetAnalyticsSettings, { payload: context.payload }));

export const updateAnalyticsSettings = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/settings/analytics" })
	.input(analyticsUpdateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateAnalyticsSettings, { payload: context.payload, ...input }));

export const getAppearanceSettings = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/settings/appearance" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetAppearanceSettings, { payload: context.payload }));

export const updateAppearanceSettings = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/settings/appearance" })
	.input(appearanceUpdateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateAppearanceSettings, { payload: context.payload, ...input }));

export const getMaintenanceSettings = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/settings/maintenance" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetMaintenanceSettings, { payload: context.payload }));

export const updateMaintenanceSettings = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/settings/maintenance" })
	.input(maintenanceUpdateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateMaintenanceSettings, { payload: context.payload, ...input }));

export const getRegistrationSettings = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/settings/registration" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetRegistrationSettings, { payload: context.payload }));

export const updateRegistrationSettings = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/settings/registration" })
	.input(registrationUpdateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateRegistrationSettings, { payload: context.payload, ...input }));

export const getSitePolicies = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/settings/site-policies" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetSitePolicies, { payload: context.payload }));

export const updateSitePolicies = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/settings/site-policies" })
	.input(sitePoliciesUpdateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateSitePolicies, { payload: context.payload, ...input }));
