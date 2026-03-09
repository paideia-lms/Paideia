import type { File } from "payload-types";
import type { User, Media } from "payload-types";
import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "@paideia/shared";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateFile } from "../services/file-management";
import type { FileSeedData } from "./file-seed-schema";

export interface TrySeedFilesArgs extends BaseInternalFunctionArgs {
	data: FileSeedData;
	usersByEmail: Map<string, User>;
	mediaByFilename?: Map<string, Media>;
}

export interface SeedFilesResult {
	files: File[];
}

class FilesSeedBuilder extends SeedBuilder<
	FileSeedData["files"][number],
	File
> {
	readonly entityName = "file";
	private usersByEmail: Map<string, User>;
	private mediaByFilename: Map<string, Media>;

	constructor(
		usersByEmail: Map<string, User>,
		mediaByFilename: Map<string, Media>,
	) {
		super();
		this.usersByEmail = usersByEmail;
		this.mediaByFilename = mediaByFilename;
	}

	protected async seedEntities(
		inputs: FileSeedData["files"][number][],
		context: SeedContext,
	): Promise<File[]> {
		const result: File[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.userEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.userEmail}. Seed users first.`,
				);
			}

			const mediaIds: number[] = [];
			if (input.mediaFilenames) {
				for (const filename of input.mediaFilenames) {
					const media = this.mediaByFilename.get(filename);
					if (!media) {
						throw new UnknownError(
							`Media not found for filename: ${filename}. Seed media first.`,
						);
					}
					mediaIds.push(media.id);
				}
			}

			const file = await tryCreateFile({
				payload: context.payload,
				data: {
					title: input.title,
					description: input.description,
					media: mediaIds,
					createdBy: user.id,
				},
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow();

			result.push(file as File);
		}

		return result;
	}
}

export function trySeedFiles(args: TrySeedFilesArgs) {
	const builder = new FilesSeedBuilder(
		args.usersByEmail,
		args.mediaByFilename ?? new Map(),
	);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.files },
		})
		.map((files) => ({ files }));
}
