import type { Payload, PayloadRequest } from "payload";
import { TransactionIdNotFoundError } from "~/utils/error";
export interface HandleTransactionIdResult {
	transactionID: string | number;
	/**
	 * if transaction created, we need to commit and rollback the transaction in the same level
	 */
	isTransactionCreated: boolean;
	reqWithTransaction: Partial<PayloadRequest>;
	/**
	 * by using tx, we can throw stuff inside the function and let the tx handle the commit and rollback for us.
	 * ! but be careful if we want to return error, it will be treated as success and commit the transaction.
	 * If that is not intended, we should use the internal commitTransactionIfCreated and rollbackTransactionIfCreated.
	 *
	 * ! In other words, this function only works when you just want to return success data inside.
	 */
	tx: <T>(
		operation: (transactionInfo: Omit<HandleTransactionIdResult, "tx">) => T,
		shouldRollback?: (result: Awaited<T>) => boolean,
	) => Promise<T>;
}

/**
 * Handles transaction ID for internal functions.
 *
 * If req.transactionID exists (and is not a Promise), uses it.
 * If req.transactionID is a Promise, awaits it.
 * Otherwise, creates a new transaction.
 *
 * when you use this function, you should always use `commitTransactionIfCreated` and `rollbackTransactionIfCreated` to commit and rollback the transaction **at the same level** as the transaction creation.
 *
 * ```typescript
 * const transactionInfo = await handleTransactionId(payload, req);
 *
 * const result = await someFunction(payload, transactionInfo.reqWithTransaction);
 *
 * if (!result.ok) {
 *   await rollbackTransactionIfCreated(payload, transactionInfo);
 *   return;
 * }
 * await commitTransactionIfCreated(payload, transactionInfo);
 *
 * ```
 *
 * @param payload - Payload instance
 * @param req - Optional request object that may contain a transactionID
 * @returns Object containing transactionID, shouldCommitTransaction flag, and reqWithTransaction
 * @throws TransactionIdNotFoundError if transaction creation fails
 */
export async function handleTransactionId(
	payload: Payload,
	req?: Partial<PayloadRequest>,
): Promise<HandleTransactionIdResult> {
	let transactionID: string | number | undefined;
	let isTransactionCreated = false;

	if (req?.transactionID) {
		const reqTransactionID = req.transactionID;
		if (reqTransactionID instanceof Promise) {
			transactionID = await reqTransactionID;
		} else if (
			typeof reqTransactionID === "string" ||
			typeof reqTransactionID === "number"
		) {
			transactionID = reqTransactionID;
		}
	} else {
		const newTransactionID = await payload.db.beginTransaction();
		if (!newTransactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}
		transactionID = newTransactionID;
		isTransactionCreated = true;
	}

	// Ensure transactionID is defined (TypeScript narrowing)
	if (!transactionID) {
		throw new TransactionIdNotFoundError("Transaction ID is required");
	}

	// Merge transactionID into req
	const reqWithTransaction: Partial<PayloadRequest> = {
		...req,
		transactionID,
	};

	const _transactionInfo = {
		transactionID,
		isTransactionCreated,
		reqWithTransaction,
	};

	const tx = async <T>(
		operation: (transactionInfo: Omit<HandleTransactionIdResult, "tx">) => T,
		shouldRollback?: (result: Awaited<T>) => boolean,
	) => {
		try {
			const o = operation(_transactionInfo);
			const isAsyncOperation = o instanceof Promise;
			const value = isAsyncOperation ? await o : o;
			if (
				shouldRollback?.(await value) &&
				_transactionInfo.isTransactionCreated
			) {
				await payload.db.rollbackTransaction(_transactionInfo.transactionID);
				return value;
			}
			// commit the transaction if it was created
			if (_transactionInfo.isTransactionCreated) {
				await payload.db.commitTransaction(_transactionInfo.transactionID);
			}
			return value;
		} catch (error) {
			// rollback the transaction if it was created
			if (_transactionInfo.isTransactionCreated) {
				await payload.db.rollbackTransaction(_transactionInfo.transactionID);
			}
			throw error;
		}
	};

	return {
		transactionID,
		isTransactionCreated,
		reqWithTransaction,
		tx,
	};
}

/**
 * get the drizzle interactive transaction from payload using the transactionID.
 *
 * Get the drizzle transaction. This is the tx you would get by using `await payload.db.drizzle.transaction(async (tx) => {});`
 * This is a bit of an undocumented hack.
 * https://www.reddit.com/r/PayloadCMS/comments/1lrgx2e/payload_transactions_with_direct_drizzle_queries/
 * @param payload
 * @param transactionID
 * @returns
 */
export function getTx<T extends Payload>(
	payload: T,
	transactionID: string | number,
) {
	const session = payload.db.sessions![transactionID]!;
	return session.db as Parameters<
		Parameters<T["db"]["drizzle"]["transaction"]>[0]
	>[0];
}

/**
 * Rolls back a transaction if it was created by handleTransactionId.
 * Use this for early returns when validation fails.
 *
 * @param payload - Payload instance
 * @param transactionInfo - Transaction information from handleTransactionId
 */
export async function rollbackTransactionIfCreated(
	payload: Payload,
	transactionInfo: HandleTransactionIdResult,
): Promise<void> {
	const { transactionID, isTransactionCreated } = transactionInfo;

	if (isTransactionCreated) {
		await payload.db.rollbackTransaction(transactionID);
	}
}

/**
 * Commits a transaction if it was created by handleTransactionId.
 * Use this for early returns when validation passes.
 *
 * @param payload - Payload instance
 * @param transactionInfo - Transaction information from handleTransactionId
 */
export async function commitTransactionIfCreated(
	payload: Payload,
	transactionInfo: HandleTransactionIdResult,
): Promise<void> {
	const { transactionID, isTransactionCreated } = transactionInfo;

	if (isTransactionCreated) {
		await payload.db.commitTransaction(transactionID);
	}
}
