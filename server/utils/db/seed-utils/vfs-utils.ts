import vfs from "../../../vfs";

/**
 * Get file content from VFS as Buffer
 * Falls back to file system in development mode if VFS is empty
 */
export async function getVfsFileBuffer(path: string): Promise<Buffer | null> {
	const base64Content = (vfs as Record<string, string>)[path];
	if (base64Content) {
		return Buffer.from(base64Content, "base64");
	}

	// Fallback to file system in development mode if VFS is empty
	if (process.env.NODE_ENV === "development") {
		try {
			const file = Bun.file(path);
			if (await file.exists()) {
				const buffer = await file.arrayBuffer();
				return Buffer.from(buffer);
			}
		} catch {
			// Ignore errors, return null
		}
	}

	return null;
}

/**
 * Get file content from VFS as text
 */
export async function getVfsFileText(path: string): Promise<string | null> {
	const buffer = await getVfsFileBuffer(path);
	if (!buffer) return null;
	return buffer.toString("utf-8");
}

/**
 * Create a File object from VFS path
 */
export async function createFileFromVfs(
	path: string,
	filename: string,
	mimeType = "image/png",
): Promise<File | null> {
	const buffer = await getVfsFileBuffer(path);
	if (!buffer) return null;

	return new File([new Uint8Array(buffer)], filename, {
		type: mimeType,
	});
}
