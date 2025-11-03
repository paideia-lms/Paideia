import { generateCookie, type Payload } from "payload";

/**
 * Extract the cookie domain from the request.
 * For localhost, returns empty string (domain should be omitted).
 * For subdomains, returns parent domain with leading dot (e.g., ".localcan.dev").
 * For regular domains, returns the domain name.
 */
function getCookieDomain(domainUrl: string, headers: Headers): string {
	const url = new URL(domainUrl);
	const origin = headers.get("Origin");

	// Extract hostname from origin if present, otherwise use domainUrl
	let hostname: string;
	if (origin) {
		try {
			const originUrl = new URL(origin);
			hostname = originUrl.hostname;
		} catch {
			hostname = url.hostname;
		}
	} else {
		hostname = url.hostname;
	}

	// For localhost, omit domain entirely
	if (hostname.includes("localhost")) {
		return "";
	}

	// For subdomains, extract parent domain (e.g., "paideia-13.localcan.dev" -> ".localcan.dev")
	const parts = hostname.split(".");
	if (parts.length > 2) {
		// Has subdomain, return parent domain with leading dot
		const parentDomain = parts.slice(-2).join(".");
		return `.${parentDomain}`;
	}

	// For regular domains, return as-is
	return hostname;
}

/**
 * Determine if cookie should be secure (HTTPS only).
 * In development, allow non-secure cookies for local domains.
 */
function shouldUseSecureCookie(domainUrl: string, headers: Headers): boolean {
	const url = new URL(domainUrl);
	const origin = headers.get("Origin");

	// Check if using HTTPS
	const isHttps = url.protocol === "https:" || (origin?.startsWith("https://") ?? false);

	// For localhost and development domains (localcan.dev), allow non-secure in development
	const hostname = url.hostname;
	if (
		hostname.includes("localhost") ||
		hostname.includes("127.0.0.1") ||
		hostname.endsWith(".localcan.dev")
	) {
		// Only use secure if HTTPS is available, otherwise allow non-secure for development
		return isHttps;
	}

	// For production domains, require HTTPS
	return isHttps;
}

/**
 * Set a secure cookie for Payload authentication token.
 * - Secure: Ensures the cookie is only sent over HTTPS (when applicable).
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
	const cookieDomain = getCookieDomain(domainUrl, headers);
	const secure = shouldUseSecureCookie(domainUrl, headers);

	return generateCookie({
		name: `${payload.config.cookiePrefix}-token`,
		value: token,
		// ! When working on localhost, the cookie domain must be omitted entirely. You should not set it to "" or NULL or FALSE instead of "localhost". It is not enough. see https://stackoverflow.com/a/1188145
		domain: cookieDomain || undefined, // Omit domain property entirely if empty string
		maxAge: exp,
		httpOnly: true,
		sameSite: "Strict",
		secure,
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
	const cookieDomain = getCookieDomain(domainUrl, headers);
	const secure = shouldUseSecureCookie(domainUrl, headers);

	return generateCookie({
		name: `${payload.config.cookiePrefix}-token`,
		value: "",
		// ! When working on localhost, the cookie domain must be omitted entirely. You should not set it to "" or NULL or FALSE instead of "localhost". It is not enough. see https://stackoverflow.com/a/1188145
		domain: cookieDomain || undefined, // Omit domain property entirely if empty string
		expires: new Date(0),
		httpOnly: true,
		sameSite: "Strict",
		secure,
		returnCookieAsObject: false,
	}) as string;
}

/**
 * Set a secure cookie for impersonation user ID.
 * - Secure: Ensures the cookie is only sent over HTTPS (when applicable).
 * - HttpOnly: Not accessible to JavaScript.
 * - SameSite=Strict: Prevents CSRF.
 */
export function setImpersonationCookie(
	userId: number,
	domainUrl: string,
	headers: Headers,
	payload: Payload,
) {
	const cookieDomain = getCookieDomain(domainUrl, headers);
	const secure = shouldUseSecureCookie(domainUrl, headers);

	return generateCookie({
		name: `${payload.config.cookiePrefix}-impersonate`,
		value: String(userId),
		// ! When working on localhost, the cookie domain must be omitted entirely. You should not set it to "" or NULL or FALSE instead of "localhost". It is not enough. see https://stackoverflow.com/a/1188145
		domain: cookieDomain || undefined, // Omit domain property entirely if empty string
		path: "/", // Make cookie available site-wide
		maxAge: 60 * 60 * 24 * 7, // 1 week
		httpOnly: true,
		sameSite: "Strict",
		secure,
		returnCookieAsObject: false,
	}) as string;
}

/**
 * Remove the impersonation cookie securely.
 */
export function removeImpersonationCookie(
	domainUrl: string,
	headers: Headers,
	payload: Payload,
) {
	const cookieDomain = getCookieDomain(domainUrl, headers);
	const secure = shouldUseSecureCookie(domainUrl, headers);

	return generateCookie({
		name: `${payload.config.cookiePrefix}-impersonate`,
		value: "",
		// ! When working on localhost, the cookie domain must be omitted entirely. You should not set it to "" or NULL or FALSE instead of "localhost". It is not enough. see https://stackoverflow.com/a/1188145
		domain: cookieDomain || undefined, // Omit domain property entirely if empty string
		path: "/", // Make cookie available site-wide
		expires: new Date(0),
		httpOnly: true,
		sameSite: "Strict",
		secure,
		returnCookieAsObject: false,
	}) as string;
}
