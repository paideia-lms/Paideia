import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "../../../shared/seed-builder";
import type { BaseInternalFunctionArgs } from "shared/internal-function-utils";
import {
	tryCreateUser,
	tryGenerateApiKey,
	tryRegisterFirstUser,
} from "../services/user-management";
import type { UserSeedData } from "./user-seed-schema";

export interface TrySeedUsersArgs extends BaseInternalFunctionArgs {
	data: UserSeedData;
}

export interface SeedUserEntry {
	user: User;
	token?: string;
	apiKey?: string;
}

export interface SeedUsersResult {
	users: SeedUserEntry[];
	byEmail: Map<string, SeedUserEntry>;
	admin?: User;
	getUsersByEmail(): Map<string, User>;
}

class UsersSeedBuilder extends SeedBuilder<
	UserSeedData["users"][number],
	SeedUserEntry
> {
	readonly entityName = "user";
	private dbIsEmpty?: boolean;

	protected async seedEntities(
		inputs: UserSeedData["users"][number][],
		context: SeedContext,
	): Promise<SeedUserEntry[]> {
		const result: SeedUserEntry[] = [];

		const existingUsers = await context.payload.find({
			collection: "users",
			limit: 1,
			overrideAccess: true,
			req: context.req,
		});
		this.dbIsEmpty = existingUsers.docs.length === 0;

		for (let i = 0; i < inputs.length; i++) {
			const input = inputs[i]!;
			const shouldLogin =
				input.login ?? (i === 0 && input.role === "admin");

			let user: User;

			if (i === 0 && this.dbIsEmpty && input.role === "admin") {
				const registerResult = await tryRegisterFirstUser({
					payload: context.payload,
					req: context.req,
					email: input.email,
					password: input.password,
					firstName: input.firstName,
					lastName: input.lastName,
				}).getOrThrow();

				user = registerResult.user;

				const entry: SeedUserEntry = {
					user,
					token: shouldLogin ? registerResult.token : undefined,
				};
				result.push(entry);

				if (input.generateApiKey) {
					const apiKeyResult = await tryGenerateApiKey({
						payload: context.payload,
						userId: user.id,
						req: context.req,
						overrideAccess: context.overrideAccess,
					}).getOrThrow();
					entry.apiKey = apiKeyResult.apiKey;
				}
				continue;
			}

			const createResult = await tryCreateUser({
				payload: context.payload,
				data: {
					email: input.email,
					password: input.password,
					firstName: input.firstName,
					lastName: input.lastName,
					role: input.role,
				},
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow();

			user = createResult;

			await context.payload.update({
				collection: "users",
				id: user.id,
				data: { _verified: true },
				overrideAccess: true,
				req: context.req,
			});

			const entry: SeedUserEntry = {
				user,
			};

			if (input.generateApiKey) {
				const apiKeyResult = await tryGenerateApiKey({
					payload: context.payload,
					userId: user.id,
					req: context.req,
					overrideAccess: context.overrideAccess,
				}).getOrThrow();
				entry.apiKey = apiKeyResult.apiKey;
			}

			if (shouldLogin) {
				const loginResult = await context.payload.login({
					collection: "users",
					data: {
						email: input.email,
						password: input.password,
					},
					overrideAccess: true,
					req: context.req,
				});
				if (loginResult.token) {
					entry.token = loginResult.token;
				}
			}

			result.push(entry);
		}

		return result;
	}
}

export function trySeedUsers(args: TrySeedUsersArgs) {
	const builder = new UsersSeedBuilder();

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.users },
		})
		.map((users) => {
			const byEmail = new Map<string, SeedUserEntry>();
			let admin: User | undefined;

			for (const entry of users) {
				byEmail.set(entry.user.email, entry);
				if (entry.user.role === "admin" && !admin) {
					admin = entry.user;
				}
			}

			const getUsersByEmail = () =>
				new Map([...byEmail.entries()].map(([k, v]) => [k, v.user]));

			return { users, byEmail, admin, getUsersByEmail };
		});
}
