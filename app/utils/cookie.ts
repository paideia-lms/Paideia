/**
 * Set a secure cookie for Payload authentication token.
 * - Secure: Ensures the cookie is only sent over HTTPS.
 * - HttpOnly: Not accessible to JavaScript.
 * - SameSite=Strict: Prevents CSRF.
 */
export function setCookie(token: string, exp: number, domainUrl: string) {
	// Derive domain parameter if needed
	const url = new URL(domainUrl);
	const domain = url.hostname === "localhost" ? "" : `Domain=${url.hostname}; `;
	return `payload-token=${token}; Path=/; ${domain}HttpOnly; Secure; SameSite=Strict; Max-Age=${exp}`;
}

/**
 * Remove the Payload authentication cookie securely.
 */
export function removeCookie(domainUrl: string) {
	const url = new URL(domainUrl);
	const domain = url.hostname === "localhost" ? "" : `Domain=${url.hostname}; `;
	return `payload-token=; Path=/; ${domain}HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function getTokenFromCookie(headers: Headers) {
	const cookie = headers.get("Cookie");
	if (!cookie) {
		return null;
	}
	// get the payload-token=
	const token = cookie.split("payload-token=")[1].split(";")[0];
	if (!token) {
		return null;
	}
	return token;
}
