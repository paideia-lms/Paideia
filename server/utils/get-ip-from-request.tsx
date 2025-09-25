import type { RequestHeaders } from "request-ip";

/**
 * this function is used to get the ip from the request headers
 * it is used to get the ip from the request headers
 */
export const getIpFromRequest = (req: Request) => {
	// "x-client-ip"?: string | undefined;
	// "x-forwarded-for"?: string | undefined;
	// "x-real-ip"?: string | undefined;
	// "x-cluster-client-ip"?: string | undefined;
	// "x-forwarded"?: string | undefined;
	// "forwarded-for"?: string | undefined;
	// "forwarded"?: string | undefined;
	// "cf-connecting-ip"?: string | undefined;
	// try getting the ip from the request headers
	const headers = req.headers as unknown as RequestHeaders;
	const ip =
		headers["cf-connecting-ip"] ||
		headers["x-forwarded-for"] ||
		headers["x-real-ip"] ||
		headers["x-client-ip"] ||
		headers["x-cluster-client-ip"] ||
		headers["x-forwarded"] ||
		headers["forwarded-for"] ||
		headers["forwarded"];
	return ip as string | undefined;
};
