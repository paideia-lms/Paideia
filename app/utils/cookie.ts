import {
	extractJWT,
	generateCookie,
	type Payload,
	parseCookies,
} from "payload";

/**
 * Set a secure cookie for Payload authentication token.
 * - Secure: Ensures the cookie is only sent over HTTPS.
 * - HttpOnly: Not accessible to JavaScript.
 * - SameSite=Strict: Prevents CSRF.
 */
export function setCookie(
	token: string,
	exp: number,
	domainUrl: string,
	headers: Headers,
	payload: Payload,
) {
	// Derive domain parameter if needed
	const url = new URL(domainUrl);
	const origin = headers.get("Origin");
	const domain = origin ? origin : url.hostname;
	const isLocalhost = domain.includes("localhost");
	return generateCookie({
		name: `${payload.config.cookiePrefix}-token`,
		value: token,
		// ! When working on localhost, the cookie domain must be omitted entirely. You should not set it to "" or NULL or FALSE instead of "localhost". It is not enough. see https://stackoverflow.com/a/1188145
		domain: isLocalhost ? "" : domain,
		maxAge: exp,
		httpOnly: true,
		sameSite: "Strict",
		secure: true,
		returnCookieAsObject: false,
	}) as string;
}

/**
 * Remove the Payload authentication cookie securely.
 */
export function removeCookie(
	domainUrl: string,
	headers: Headers,
	payload: Payload,
) {
	const url = new URL(domainUrl);
	const origin = headers.get("Origin");
	const domain = origin ? origin : url.hostname;
	const isLocalhost = domain.includes("localhost");
	return generateCookie({
		name: `${payload.config.cookiePrefix}-token`,
		value: "",
		// ! When working on localhost, the cookie domain must be omitted entirely. You should not set it to "" or NULL or FALSE instead of "localhost". It is not enough. seehttps://stackoverflow.com/a/1188145
		domain: isLocalhost ? "" : domain,
		expires: new Date(0),
		httpOnly: true,
		sameSite: "Strict",
		secure: true,
		returnCookieAsObject: false,
	}) as string;
}
