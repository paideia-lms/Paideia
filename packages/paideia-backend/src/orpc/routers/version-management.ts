import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { tryGetLatestVersion } from "../../internal/version-management";

const inputSchema = z.object({
	currentVersion: z.string(),
});

const outputSchema = z.object({
	latestVersion: z.string(),
	currentVersion: z.string(),
	isUpdateAvailable: z.boolean(),
});

export const getLatestVersion = os
	.route({ method: "GET", path: "/version/latest" })
	.input(inputSchema)
	.output(outputSchema)
	.handler(async ({ input }) => {
		const result = await tryGetLatestVersion({
			currentVersion: input.currentVersion,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
			});
		}
		return result.value;
	});
