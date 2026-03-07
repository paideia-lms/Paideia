import type { Page } from "payload-types";
import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "shared/seed-builder";
import { UnknownError } from "../../../errors";
import type { BaseInternalFunctionArgs } from "shared/internal-function-utils";
import { tryCreatePage } from "../services/page-management";
import type { PageSeedData } from "./page-seed-schema";

export interface TrySeedPagesArgs extends BaseInternalFunctionArgs {
	data: PageSeedData;
	usersByEmail: Map<string, User>;
}

export interface SeedPagesResult {
	pages: Page[];
}

class PagesSeedBuilder extends SeedBuilder<
	PageSeedData["pages"][number],
	Page
> {
	readonly entityName = "page";
	private usersByEmail: Map<string, User>;

	constructor(usersByEmail: Map<string, User>) {
		super();
		this.usersByEmail = usersByEmail;
	}

	protected async seedEntities(
		inputs: PageSeedData["pages"][number][],
		context: SeedContext,
	): Promise<Page[]> {
		const result: Page[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.userEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.userEmail}. Seed users first.`,
				);
			}

			const page = await tryCreatePage({
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

			result.push(page as Page);
		}

		return result;
	}
}

export function trySeedPages(args: TrySeedPagesArgs) {
	const builder = new PagesSeedBuilder(args.usersByEmail);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.pages },
		})
		.map((pages) => ({ pages }));
}
