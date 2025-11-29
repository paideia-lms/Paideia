import { APIError } from "payload";
import type { CustomTFunction } from "server/utils/db/custom-translations";

export class CustomForbidden extends APIError {
	constructor(
		operation: string,
		userRole: string,
		resource: string,
		t?: CustomTFunction,
	) {
		const message = t
			? t("error:forbiddenAction", { operation, resource, userRole })
			: `Forbidden: Cannot perform '${operation}' on '${resource}'. User role: '${userRole}'`;

		super(message, 403);
	}
}
