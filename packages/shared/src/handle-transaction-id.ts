import type { Payload, PayloadRequest } from "payload";
import { TransactionIdNotFoundError } from "./errors";

export interface HandleTransactionIdResult {
	transactionID: string | number;
	isTransactionCreated: boolean;
	reqWithTransaction: Partial<PayloadRequest>;
	tx: <T>(
		operation: (transactionInfo: Omit<HandleTransactionIdResult, "tx">) => T,
		shouldRollback?: (result: Awaited<T>) => boolean,
	) => Promise<T>;
}

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

	if (!transactionID) {
		throw new TransactionIdNotFoundError("Transaction ID is required");
	}

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
			if (_transactionInfo.isTransactionCreated) {
				await payload.db.commitTransaction(_transactionInfo.transactionID);
			}
			return value;
		} catch (error) {
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

export function getTx(payload: Payload, transactionID: string | number): unknown {
	const session = payload.db.sessions![transactionID]!;
	return session.db;
}

export async function rollbackTransactionIfCreated(
	payload: Payload,
	transactionInfo: HandleTransactionIdResult,
): Promise<void> {
	const { transactionID, isTransactionCreated } = transactionInfo;
	if (isTransactionCreated) {
		await payload.db.rollbackTransaction(transactionID);
	}
}

export async function commitTransactionIfCreated(
	payload: Payload,
	transactionInfo: HandleTransactionIdResult,
): Promise<void> {
	const { transactionID, isTransactionCreated } = transactionInfo;
	if (isTransactionCreated) {
		await payload.db.commitTransaction(transactionID);
	}
}
