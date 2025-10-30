import type { Payload, PayloadRequest } from "payload";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import type { User } from "../payload-types";

export interface GetRegistrationSettingsArgs {
    payload: Payload;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export type RegistrationSettings = {
    disableRegistration: boolean;
    showRegistrationButton: boolean;
};

const registrationSettingsSchema = z.object({
    disableRegistration: z.boolean().optional(),
    showRegistrationButton: z.boolean().optional(),
});

/**
 * Read registration settings from the RegistrationSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetRegistrationSettings = Result.wrap(
    async (args: GetRegistrationSettingsArgs): Promise<RegistrationSettings> => {
        const { payload, user = null, req, overrideAccess = false } = args;

        const raw = await payload.findGlobal({
            slug: "registration-settings",
            user,
            req,
            overrideAccess,
        });

        const parsed = registrationSettingsSchema.safeParse(raw);

        if (!parsed.success) {
            return {
                disableRegistration: false,
                showRegistrationButton: true,
            };
        }

        return {
            disableRegistration: parsed.data.disableRegistration ?? false,
            showRegistrationButton: parsed.data.showRegistrationButton ?? true,
        };
    },
    (error) =>
        transformError(error) ??
        new UnknownError("Failed to get registration settings", { cause: error }),
);


