import type { Whiteboard } from "payload-types";
import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "shared/seed-builder";
import { UnknownError } from "../../../errors";
import type { BaseInternalFunctionArgs } from "shared/internal-function-utils";
import { tryCreateWhiteboard } from "../services/whiteboard-management";
import type { WhiteboardSeedData } from "./whiteboard-seed-schema";

export interface TrySeedWhiteboardsArgs extends BaseInternalFunctionArgs {
	data: WhiteboardSeedData;
	usersByEmail: Map<string, User>;
}

export interface SeedWhiteboardsResult {
	whiteboards: Whiteboard[];
}

class WhiteboardsSeedBuilder extends SeedBuilder<
	WhiteboardSeedData["whiteboards"][number],
	Whiteboard
> {
	readonly entityName = "whiteboard";
	private usersByEmail: Map<string, User>;

	constructor(usersByEmail: Map<string, User>) {
		super();
		this.usersByEmail = usersByEmail;
	}

	protected async seedEntities(
		inputs: WhiteboardSeedData["whiteboards"][number][],
		context: SeedContext,
	): Promise<Whiteboard[]> {
		const result: Whiteboard[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.userEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.userEmail}. Seed users first.`,
				);
			}

			const whiteboard = await tryCreateWhiteboard({
				payload: context.payload,
				data: {
					title: input.title,
					description: input.description,
					content: input.content,
					createdBy: user.id,
				},
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow();

			result.push(whiteboard as Whiteboard);
		}

		return result;
	}
}

export function trySeedWhiteboards(args: TrySeedWhiteboardsArgs) {
	const builder = new WhiteboardsSeedBuilder(args.usersByEmail);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.whiteboards },
		})
		.map((whiteboards) => ({ whiteboards }));
}
