import mime from "mime";
import type { IncomingHttpHeaders } from "node:http";
import { isCachedVfs } from "./cache";

type VfsMap = Record<string, string>;

const IGNORE_PATTERNS = [".DS_Store", ".git", ".env"];

function generateETagFromBuffer(buffer: Buffer): string {
	const hash = new Bun.CryptoHasher("md5");
	hash.update(buffer);
	return hash.digest("base64");
}

function getVfsFile(vfs: VfsMap, path: string): Buffer | null {
	const base64Content = vfs[path];
	if (!base64Content) return null;
	return Buffer.from(base64Content, "base64");
}

function listVfsFiles(vfs: VfsMap): string[] {
	return Object.keys(vfs);
}

function shouldIgnore(file: string): boolean {
	return IGNORE_PATTERNS.some((pattern) => file.includes(pattern));
}

interface VfsEntry {
	buffer: Buffer;
	etag: string;
	mime: string | false;
}

let cachedIndex: Map<string, VfsEntry> | null = null;
let cachedVfs: VfsMap | null = null;

function buildVfsIndex(vfs: VfsMap): Map<string, VfsEntry> {
	if (vfs === cachedVfs && cachedIndex) return cachedIndex;
	const index = new Map<string, VfsEntry>();
	const files = listVfsFiles(vfs);

	for (const relativePath of files) {
		if (!relativePath || shouldIgnore(relativePath)) continue;

		const fileBuffer = getVfsFile(vfs, relativePath);
		if (!fileBuffer) continue;

		const m = mime.getType(relativePath);
		const etag = generateETagFromBuffer(fileBuffer);

		const entry: VfsEntry = { buffer: fileBuffer, etag, mime: m ?? false };
		// Index by both path formats for URL matching
		index.set(relativePath, entry);
		index.set("/" + relativePath, entry);
	}

	cachedVfs = vfs;
	cachedIndex = index;
	return index;
}

export interface ServeVfsOptions {
	prefix?: string;
	maxAge?: number;
	directive?: string;
	noCache?: boolean;
}

/**
 * Serves static assets from a VFS (virtual file system) map.
 * Returns a Response if the request path matches a file in the VFS, otherwise null.
 */
export async function serveFromVfs(
	request: Request,
	vfs: VfsMap,
	options: ServeVfsOptions = {},
): Promise<Response | null> {
	const {
		prefix = "",
		maxAge = 31536000,
		directive = "public",
		noCache = false,
	} = options;

	const url = new URL(request.url);
	let pathname = url.pathname;

	if (prefix && pathname.startsWith(prefix)) {
		pathname = pathname.slice(prefix.length) || "/";
	}

	const index = buildVfsIndex(vfs);
	const entry = index.get(pathname) ?? index.get(pathname.replace(/^\//, ""));

	if (!entry) {
		// Check for index.html for directory paths (e.g. / -> index.html)
		if (pathname === "/" || pathname === "") {
			const indexEntry = index.get("index.html") ?? index.get("/index.html");
			if (indexEntry) {
				return createVfsResponse(
					request,
					indexEntry,
					noCache,
					directive,
					maxAge,
				);
			}
		}
		return null;
	}

	return createVfsResponse(request, entry, noCache, directive, maxAge);
}

async function createVfsResponse(
	request: Request,
	entry: VfsEntry,
	noCache: boolean,
	directive: string,
	maxAge: number,
): Promise<Response> {
	const headers: Record<string, string> = {
		"Content-Type": entry.mime || "application/octet-stream",
	};

	if (!noCache) {
		const reqHeaders = Object.fromEntries(
			request.headers.entries(),
		) as IncomingHttpHeaders;
		if (await isCachedVfs(reqHeaders, entry.etag)) {
			return new Response(null, {
				status: 304,
				headers,
			});
		}
		headers.Etag = entry.etag;
		headers["Cache-Control"] = `${directive}, max-age=${maxAge}`;
	}

	return new Response(new Uint8Array(entry.buffer), {
		headers,
	});
}
