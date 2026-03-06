import type {
	BasePayload,
	PayloadRequest,
	TypedUser,
} from "payload";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "../errors";
import { handleTransactionId } from "./handle-transaction-id";

interface BaseUser extends Omit<TypedUser, "avatar"> {}

interface BaseRequest extends Omit<Partial<PayloadRequest>, "user"> {
	user?: BaseUser | null;
}

export interface SeedContext {
	payload: BasePayload;
	req: Partial<PayloadRequest>;
	overrideAccess: boolean;
}

export interface SeedBuilderArgs<TInput> {
	payload: BasePayload;
	req: BaseRequest | undefined;
	overrideAccess?: boolean;
	data: { inputs: TInput[] };
}

export abstract class SeedBuilder<TInput, TEntity> {
	abstract readonly entityName: string;

	protected abstract seedEntities(
		inputs: TInput[],
		context: SeedContext,
	): Promise<TEntity[]>;

	trySeed(args: SeedBuilderArgs<TInput>) {
		return Result.try(
			async () => {
				const { payload, req, overrideAccess = true, data } = args;

				const transactionInfo = await handleTransactionId(payload, req);
				return transactionInfo.tx(async ({ reqWithTransaction }) => {
					return this.seedEntities(data.inputs, {
						payload,
						req: reqWithTransaction,
						overrideAccess,
					});
				});
			},
			(error) =>
				transformError(error) ??
				new UnknownError(`Failed to seed ${this.entityName}`, {
					cause: error,
				}),
		);
	}
}
