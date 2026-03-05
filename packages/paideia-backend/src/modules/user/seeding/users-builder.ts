import type { User } from "payload-types";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "../../../errors";
import { handleTransactionId } from "shared/handle-transaction-id";
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
	byEmail: Map<string, User>;
	admin?: User;
}

/**
 * Seeds users from JSON data. Supports arbitrary number of users, roles, and API key generation.
 * First user: uses tryRegisterFirstUser when DB is empty and first user is admin; else tryCreateUser.
 * Subsequent users: tryCreateUser with overrideAccess.
 * Uses transaction; on failure rolls back.
 */
export function trySeedUsers(args: TrySeedUsersArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				req,
				overrideAccess = true,
				data: { users: usersInput },
			} = args;

			const transactionInfo = await handleTransactionId(payload, req);
			return transactionInfo.tx(async ({ reqWithTransaction }) => {
				const result: SeedUserEntry[] = [];
				const byEmail = new Map<string, User>();
				let admin: User | undefined;

				const existingUsers = await payload.find({
					collection: "users",
					limit: 1,
					overrideAccess: true,
					req: reqWithTransaction,
				});
				const isDbEmpty = existingUsers.docs.length === 0;

				for (let i = 0; i < usersInput.length; i++) {
					const input = usersInput[i]!;
					const shouldLogin =
						input.login ?? (i === 0 && input.role === "admin");

					let user: User;

					if (i === 0 && isDbEmpty && input.role === "admin") {
						const registerResult = await tryRegisterFirstUser({
							payload,
							req: reqWithTransaction,
							email: input.email,
							password: input.password,
							firstName: input.firstName,
							lastName: input.lastName,
						}).getOrThrow();

						user = registerResult.user;

						const entry: SeedUserEntry = {
							user,
							token: shouldLogin
								? registerResult.token
								: undefined,
						};
						result.push(entry);
						byEmail.set(user.email, user);
						admin = user;

						if (input.generateApiKey) {
							const apiKeyResult = await tryGenerateApiKey({
								payload,
								userId: user.id,
								req: reqWithTransaction,
								overrideAccess,
							}).getOrThrow();
							entry.apiKey = apiKeyResult.apiKey;
						}
						continue;
					}

					const createResult = await tryCreateUser({
						payload,
						data: {
							email: input.email,
							password: input.password,
							firstName: input.firstName,
							lastName: input.lastName,
							role: input.role,
						},
						req: reqWithTransaction,
						overrideAccess,
					}).getOrThrow();

					user = createResult;

					await payload.update({
						collection: "users",
						id: user.id,
						data: { _verified: true },
						overrideAccess: true,
						req: reqWithTransaction,
					});

					const entry: SeedUserEntry = {
						user,
					};

					if (input.generateApiKey) {
						const apiKeyResult = await tryGenerateApiKey({
							payload,
							userId: user.id,
							req: reqWithTransaction,
							overrideAccess,
						}).getOrThrow();
						entry.apiKey = apiKeyResult.apiKey;
					}

					if (shouldLogin) {
						const loginResult = await payload.login({
							collection: "users",
							data: {
								email: input.email,
								password: input.password,
							},
							overrideAccess: true,
							req: reqWithTransaction,
						});
						if (loginResult.token) {
							entry.token = loginResult.token;
						}
					}

					result.push(entry);
					byEmail.set(user.email, user);
					if (user.role === "admin" && !admin) {
						admin = user;
					}
				}

				return { users: result, byEmail, admin };
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to seed users", { cause: error }),
	);
}
