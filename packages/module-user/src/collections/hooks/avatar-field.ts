import type { RelationshipField } from "payload";
import { tryCreateMedia } from "../../services/media-management";

function isFile(value: unknown): value is File {
	return (
		value != null &&
		typeof value === "object" &&
		"name" in value &&
		"arrayBuffer" in value &&
		"type" in value &&
		typeof (value as File).name === "string" &&
		typeof (value as File).arrayBuffer === "function" &&
		typeof (value as File).type === "string"
	);
}

/** Minimal config required for mediaFieldWithHook. Must include relationTo, name, type. */
export interface MediaFieldWithHookBaseConfig
	extends Pick<RelationshipField, "name" | "type" | "relationTo"> {
	label?: string;
	hasMany?: boolean;
	saveToJWT?: boolean;
	[key: string]: unknown;
}

/**
 * Returns the avatar field configuration with a beforeChange hook that converts
 * File inputs to media IDs via tryCreateMedia.
 *
 * Use in collection fields like richTextContentWithHook:
 * ```ts
 * fields: [
 *   ...mediaFieldWithHook({ name: "avatar", type: "relationship", relationTo: "media" }).fields,
 * ]
 * ```
 *
 * When the incoming value is a File, the hook creates a media record and returns
 * the media ID. When the value is already a number (media ID) or null/undefined,
 * it is returned unchanged.
 *
 * userId for tryCreateMedia:
 * - Update: originalDoc.id (the document being updated)
 * - Create: req?.user?.id ?? 1 (creator or fallback for overrideAccess seeds)
 */
export function mediaFieldWithHook<T extends MediaFieldWithHookBaseConfig>(
	baseField: T,
): { fields: [RelationshipField] } {
	// @ts-ignore
	const mediaField: RelationshipField = {
		saveToJWT: true,
		...baseField,
		admin: {},
		hooks: {
			beforeChange: [async ({
				value,
				req,
				operation,
				originalDoc,
			}) => {
				if (!isFile(value)) {
					return value;
				}

				const payload = req?.payload;
				if (!payload) {
					throw new Error(
						"Avatar field hook: req.payload is required for File upload",
					);
				}

				const userId =
					operation === "update" && typeof originalDoc?.id === "number"
						? originalDoc.id
						: (req?.user?.id ?? 1);

				const file = value as File;
				const buffer = Buffer.from(await file.arrayBuffer());

				const mediaReq = req?.transactionID
					? { transactionID: req.transactionID }
					: req;

				const result = await tryCreateMedia({
					payload,
					file: buffer,
					filename: file.name,
					mimeType: file.type,
					alt: "User avatar",
					caption: "User avatar",
					userId,
					req: mediaReq as Parameters<typeof tryCreateMedia>[0]["req"],
					overrideAccess: true,
				});

				if (!result.ok) {
					throw result.error;
				}

				return result.value.media.id;
			},
			],
		},
	};

	return { fields: [mediaField] };
}
