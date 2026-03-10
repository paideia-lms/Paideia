import {
	Alert,
	Loader,
	Stack,
	Text,
	useMantineColorScheme,
} from "@mantine/core";
import MonacoEditor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { getTextPreviewLanguage } from "~/utils/media-helpers";

/** Max file size to fetch for preview (Monaco handles large content; we still limit fetch) */
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024; // 5MB

const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

/** Magic bytes for common binary formats (only need a short prefix) */
const BINARY_SIGNATURES: ReadonlyArray<Uint8Array> = [
	new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
	new Uint8Array([0xff, 0xd8, 0xff]), // JPEG
	new Uint8Array([0x47, 0x49, 0x46, 0x38]), // GIF8
	new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
	new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // ZIP
	new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // ZIP empty
];

function isBinaryBuffer(buffer: ArrayBuffer): boolean {
	const bytes = new Uint8Array(buffer);
	if (bytes.length === 0) return false;

	for (const sig of BINARY_SIGNATURES) {
		if (bytes.length >= sig.length) {
			let match = true;
			for (let i = 0; i < sig.length; i++) {
				if (bytes[i] !== sig[i]) {
					match = false;
					break;
				}
			}
			if (match) return true;
		}
	}

	// Heuristic: if a large share of the first 8KB are control chars, treat as binary
	const sample = bytes.subarray(0, Math.min(8192, bytes.length));
	let controlCount = 0;
	for (let i = 0; i < sample.length; i++) {
		const b = sample[i];
		if (b !== undefined && b < 32 && b !== 0x09 && b !== 0x0a && b !== 0x0d)
			controlCount++;
	}
	if (sample.length > 0 && controlCount / sample.length > 0.05) return true;

	return false;
}

/**
 * Decode array buffer to string. Tries UTF-8 first (with BOM strip), then ISO-8859-1
 * if UTF-8 produces many replacement characters (e.g. file is Latin-1 or binary-safe).
 */
function decodeText(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const hasBom =
		bytes.length >= 3 &&
		bytes[0] === UTF8_BOM[0] &&
		bytes[1] === UTF8_BOM[1] &&
		bytes[2] === UTF8_BOM[2];
	const view = hasBom ? bytes.subarray(3) : bytes;

	const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(view);
	const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
	// If more than ~0.5% replacement chars, likely wrong encoding; try ISO-8859-1
	if (replacementCount > view.length * 0.005) {
		return new TextDecoder("iso-8859-1").decode(view);
	}
	return utf8;
}

interface MediaPreviewTextProps {
	fileUrl: string;
	filename: string | null | undefined;
	fileSize?: number | null;
	/** When false, skips fetch (e.g. when modal is closed) */
	active?: boolean;
}

export function MediaPreviewText({
	fileUrl,
	filename,
	fileSize,
	active = true,
}: MediaPreviewTextProps) {
	const { colorScheme } = useMantineColorScheme();
	const [content, setContent] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!active) return;
		if (fileSize != null && fileSize > MAX_PREVIEW_BYTES) {
			setError(
				`File is too large to preview (max ${MAX_PREVIEW_BYTES / 1024 / 1024}MB)`,
			);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		setContent(null);

		fetch(fileUrl)
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
				const contentLength = res.headers.get("Content-Length");
				if (
					contentLength &&
					Number.parseInt(contentLength, 10) > MAX_PREVIEW_BYTES
				) {
					throw new Error(
						`File is too large to preview (max ${MAX_PREVIEW_BYTES / 1024 / 1024}MB)`,
					);
				}
				return res.arrayBuffer();
			})
			.then((buffer) => {
				if (cancelled) return;
				if (isBinaryBuffer(buffer)) {
					setError(
						"This file appears to be binary (e.g. an image or PDF) and cannot be previewed as text. The file extension may not match the actual content.",
					);
					setContent(null);
					return;
				}
				setContent(decodeText(buffer));
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load file");
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [fileUrl, fileSize, active]);

	if (loading) {
		return (
			<Stack align="center" gap="md" py="xl">
				<Loader size="sm" />
				<Text size="sm" c="dimmed">
					Loading preview...
				</Text>
			</Stack>
		);
	}

	if (error) {
		return (
			<Alert color="red" title="Preview unavailable">
				{error}
			</Alert>
		);
	}

	if (content === null) return null;

	const language = getTextPreviewLanguage(filename);
	// Monaco uses "typescript" for both .ts and .tsx
	const monacoLanguage = language === "tsx" ? "typescript" : language;

	return (
		<MonacoEditor
			height="80vh"
			language={monacoLanguage}
			value={content}
			theme={colorScheme === "dark" ? "vs-dark" : "light"}
			options={{
				readOnly: true,
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				fontSize: 14,
				lineNumbers: "on",
				wordWrap: "on",
			}}
		/>
	);
}
