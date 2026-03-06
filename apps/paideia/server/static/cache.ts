// from https://github.com/elysiajs/elysia-static/blob/main/src/cache.ts

import type { BunFile } from "bun";
import { stat } from "node:fs/promises";

export async function isCached(
	headers: Record<string, string | undefined>,
	etag: string,
	filePath: string,
) {
	// Always return stale when Cache-Control: no-cache
	// to support end-to-end reload requests
	// https://tools.ietf.org/html/rfc2616#section-14.9.4
	if (
		headers["cache-control"] &&
		headers["cache-control"].indexOf("no-cache") !== -1
	)
		return false;

	// if-none-match
	if ("if-none-match" in headers) {
		const ifNoneMatch = headers["if-none-match"];

		if (ifNoneMatch === "*") return true;

		if (ifNoneMatch === null) return false;

		if (typeof etag !== "string") return false;

		const isMatching = ifNoneMatch === etag;

		if (isMatching) return true;

		/**
		 * A recipient MUST ignore If-Modified-Since if the request contains an
		 * If-None-Match header field; the condition in If-None-Match is considered
		 * to be a more accurate replacement for the condition in If-Modified-Since,
		 * and the two are only combined for the sake of interoperating with older
		 * intermediaries that might not implement If-None-Match.
		 *
		 * @see RFC 9110 section 13.1.3
		 */
		return false;
	}

	// if-modified-since
	if (headers["if-modified-since"]) {
		const ifModifiedSince = headers["if-modified-since"];
		let lastModified: Date | undefined;
		try {
			lastModified = (await stat(filePath)).mtime;
		} catch {
			/* empty */
		}

		if (
			lastModified !== undefined &&
			lastModified.getTime() <= Date.parse(ifModifiedSince)
		)
			return true;
	}

	return false;
}

/**
 * VFS variant: only checks if-none-match and cache-control.
 * Skips if-modified-since since VFS paths are virtual (no real file to stat).
 */
export async function isCachedVfs(
	headers: Record<string, string | string[] | undefined>,
	etag: string,
): Promise<boolean> {
	const normalized = Object.fromEntries(
		Object.entries(headers).map(([k, v]) => [
			k.toLowerCase(),
			typeof v === "string" ? v : v?.[0],
		]),
	) as Record<string, string | undefined>;

	if (
		normalized["cache-control"] &&
		normalized["cache-control"].indexOf("no-cache") !== -1
	)
		return false;

	if ("if-none-match" in normalized) {
		const ifNoneMatch = normalized["if-none-match"];
		if (ifNoneMatch === "*") return true;
		if (ifNoneMatch === null || ifNoneMatch === undefined) return false;
		if (typeof etag !== "string") return false;
		return ifNoneMatch === etag;
	}

	return false;
}

/**
 * @knipignore
 */
export async function generateETag(file: BunFile) {
	const hash = new Bun.CryptoHasher("md5");
	hash.update(await file.arrayBuffer());

	return hash.digest("base64");
}
