import { os } from "@orpc/server";
import { z } from "zod";
import {
	tryGrantAccessToActivityModule,
	tryRevokeAccessFromActivityModule,
	tryFindGrantsByActivityModule,
	tryFindInstructorsForActivityModule,
	tryFindAutoGrantedModulesForInstructor,
} from "../../internal/activity-module-access";
import type { OrpcContext } from "../context";
import { run } from "../utils/handler";

const outputSchema = z.any();

const grantSchema = z.object({
	activityModuleId: z.coerce.number().int().min(1),
	grantedToUserId: z.coerce.number().int().min(1),
	grantedByUserId: z.coerce.number().int().min(1),
});

const revokeSchema = z.object({
	activityModuleId: z.coerce.number().int().min(1),
	userId: z.coerce.number().int().min(1),
});

const activityModuleIdSchema = z.object({
	activityModuleId: z.coerce.number().int().min(1),
});

const instructorIdSchema = z.object({
	instructorId: z.coerce.number().int().min(1),
});

export const grantAccess = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/activity-module-access/grant" })
	.input(grantSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGrantAccessToActivityModule, { payload: context.payload, ...input }));

export const revokeAccess = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/activity-module-access/revoke" })
	.input(revokeSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryRevokeAccessFromActivityModule, { payload: context.payload, ...input }));

export const findGrantsByActivityModule = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/activity-module-access/grants/{activityModuleId}" })
	.input(activityModuleIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindGrantsByActivityModule, { payload: context.payload, ...input }),
	);

export const findInstructorsForActivityModule = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/activity-module-access/instructors/{activityModuleId}" })
	.input(activityModuleIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindInstructorsForActivityModule, { payload: context.payload, ...input }),
	);

export const findAutoGrantedModulesForInstructor = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/activity-module-access/auto-granted/{instructorId}" })
	.input(instructorIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindAutoGrantedModulesForInstructor, { payload: context.payload, ...input }),
	);
