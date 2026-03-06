import type { Note } from "payload-types";
import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "shared/seed-builder";
import { UnknownError } from "../../../errors";
import type { BaseInternalFunctionArgs } from "shared/internal-function-utils";
import { tryCreateNote } from "../services/note-management";
import type { NoteSeedData } from "./note-seed-schema";

export interface TrySeedNotesArgs extends BaseInternalFunctionArgs {
	data: NoteSeedData;
	usersByEmail: Map<string, User>;
}

export interface SeedNotesResult {
	notes: Note[];
}

class NotesSeedBuilder extends SeedBuilder<
	NoteSeedData["notes"][number],
	Note
> {
	readonly entityName = "note";
	private usersByEmail: Map<string, User>;

	constructor(usersByEmail: Map<string, User>) {
		super();
		this.usersByEmail = usersByEmail;
	}

	protected async seedEntities(
		inputs: NoteSeedData["notes"][number][],
		context: SeedContext,
	): Promise<Note[]> {
		const result: Note[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.userEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.userEmail}. Seed users first.`,
				);
			}

			const note = await tryCreateNote({
				payload: context.payload,
				data: {
					content: input.content,
					createdBy: user.id,
					isPublic: input.isPublic,
				},
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow();

			result.push(note);
		}

		return result;
	}
}

export function trySeedNotes(args: TrySeedNotesArgs) {
	const builder = new NotesSeedBuilder(args.usersByEmail);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.notes },
		})
		.map((notes) => ({ notes }));
}
