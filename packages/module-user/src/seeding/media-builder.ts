import type { Media } from "payload-types";
import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "@paideia/shared";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateMedia } from "../services/media-management";
import type { MediaSeedData } from "./media-seed-schema";

export interface TrySeedMediaArgs extends BaseInternalFunctionArgs {
	data: MediaSeedData;
	usersByEmail: Map<string, User>;
}

export interface SeedMediaResult {
	media: Media[];
	byFilename: Map<string, Media>;
	getByFilename(filename: string): Media;
}

async function getFileBuffer(filePath: string): Promise<Buffer | null> {
	try {
		const file = Bun.file(filePath);
		if (await file.exists()) {
			const arrayBuffer = await file.arrayBuffer();
			return Buffer.from(arrayBuffer);
		}
	} catch {
	}
	return null;
}

class MediaSeedBuilder extends SeedBuilder<
	MediaSeedData["media"][number],
	Media
> {
	readonly entityName = "media";
	private usersByEmail: Map<string, User>;

	constructor(usersByEmail: Map<string, User>) {
		super();
		this.usersByEmail = usersByEmail;
	}

	protected async seedEntities(
		inputs: MediaSeedData["media"][number][],
		context: SeedContext,
	): Promise<Media[]> {
		const result: Media[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.userEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.userEmail}. Seed users first.`,
				);
			}

			const fileBuffer = await getFileBuffer(input.filePath);
			if (!fileBuffer) {
				throw new UnknownError(
					`File not found at path: ${input.filePath}`,
				);
			}

			const createResult = await tryCreateMedia({
				payload: context.payload,
				file: fileBuffer,
				filename: input.filename,
				mimeType: input.mimeType,
				alt: input.alt,
				caption: input.caption,
				userId: user.id,
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow();

			result.push(createResult.media);
		}

		return result;
	}
}

export function trySeedMedia(args: TrySeedMediaArgs) {
	const builder = new MediaSeedBuilder(args.usersByEmail);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.media },
		})
		.map((media) => {
			const byFilename = new Map<string, Media>();
			for (const m of media) {
				if (m.filename) {
					byFilename.set(m.filename, m);
				}
			}

			const getByFilename = (filename: string) => {
				const m = byFilename.get(filename);
				if (!m) {
					throw new UnknownError(
						`Media not found for filename: ${filename}`,
					);
				}
				return m;
			};

			return { media, byFilename, getByFilename };
		});
}
