/**
 * get the domain url from the request
 */
export function getDomainUrl(
	request: Request,
	options?: {
		/**
		 * base on the env, you can provide different default host
		 */
		defaultHost?: string;
		/**
		 * if the host is localhost, by default it will be http, you can override it here
		 */
		protocol?: string;
	},
) {
	const host =
		request.headers.get("X-Forwarded-Host") ??
		request.headers.get("Host") ??
		options?.defaultHost;

	if (!host) {
		throw new Error("Host is required");
	}

	const protocol =
		options?.protocol ?? (host.includes("localhost") ? "http" : "https");

	return `${protocol}://${host}`;
}
