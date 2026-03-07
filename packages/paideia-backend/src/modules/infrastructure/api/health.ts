import { os } from "@orpc/server";
import { z } from "zod";

const healthOutputSchema = z.object({
	status: z.literal("ok"),
});

const pingOutputSchema = z.object({
	pong: z.literal(true),
});

export const healthCheck = os
	.route({ method: "GET", path: "/health" })
	.output(healthOutputSchema)
	.handler(async () => ({ status: "ok" }));

export const ping = os
	.route({ method: "GET", path: "/ping" })
	.output(pingOutputSchema)
	.handler(async () => ({ pong: true }));
