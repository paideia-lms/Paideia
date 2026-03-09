import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { tryGetSystemGlobals } from "../../internal/system-globals";
import type { OrpcContext } from "../context";

const outputSchema = z.any();

export const getSystemGlobals = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/system-globals" })
	.output(outputSchema)
	.handler(async ({ context }) => {
		const result = await tryGetSystemGlobals({
			payload: context.payload,
			req: undefined,
			overrideAccess: true,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
			});
		}
		return result.value;
	});
