import type { TypedUser as PayloadUser } from "payload";
import { href } from "react-router";

export function getAvatarUrl(user: PayloadUser) {
	if (user.avatar) {
		const a =
			typeof user.avatar === "number" ? user.avatar : user.avatar.filename;
		if (a) {
			return href(`/api/media/file/:filenameOrId`, {
				filenameOrId: a.toString(),
			});
		}
	}
	return null;
}
