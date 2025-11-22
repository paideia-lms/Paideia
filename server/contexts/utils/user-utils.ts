import { href } from "react-router";
import type { TypedUser as PayloadUser } from "payload";

export function getAvatarUrl(user: PayloadUser) {
    if (user.avatar) {
        const a = typeof user.avatar === "number" ? user.avatar : user.avatar.filename;
        if (a) {
            return href(`/api/media/file/:filenameOrId`, {
                filenameOrId: a.toString(),
            });
        }
    }
    return null;
}


export type InternalFunctionRequiredUser = Pick<PayloadUser, "id" | "email" | "role">;