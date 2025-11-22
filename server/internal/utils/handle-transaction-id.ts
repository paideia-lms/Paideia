import type { Payload, PayloadRequest } from "payload";
import { TransactionIdNotFoundError } from "~/utils/error";

export interface HandleTransactionIdResult {
    transactionID: string | number;
    /** 
     * if transaction created, we need to commit and rollback the transaction in the same level
     */
    isTransactionCreated: boolean;
    reqWithTransaction: Partial<PayloadRequest>;
}

/**
 * Handles transaction ID for internal functions.
 * 
 * If req.transactionID exists (and is not a Promise), uses it.
 * If req.transactionID is a Promise, awaits it.
 * Otherwise, creates a new transaction.
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

    return {
        transactionID,
        isTransactionCreated,
        reqWithTransaction,
    };
}

