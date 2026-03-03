import { describe, expect, it, mock } from "bun:test";
import type { Payload } from "payload";
import {
	handleTransactionId,
	type HandleTransactionIdResult,
} from "./handle-transaction-id";

describe("handleTransactionId", () => {
	describe("tx method", () => {
		it("should commit transaction when operation succeeds and transaction was created", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			expect(transactionInfo.isTransactionCreated).toBe(true);
			expect(transactionInfo.transactionID).toBe("test-transaction-id");

			// Execute operation that succeeds
			const result = await transactionInfo.tx(async () => {
				return { success: true, data: "test" };
			});

			expect(result).toEqual({ success: true, data: "test" });
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(1);
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledWith(
				"test-transaction-id",
			);
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(0);
		});

		it("should not commit transaction when transaction was not created", async () => {
			const existingTransactionID = "existing-transaction-id";
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve(null)),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload, {
				transactionID: existingTransactionID,
			});

			expect(transactionInfo.isTransactionCreated).toBe(false);
			expect(transactionInfo.transactionID).toBe(existingTransactionID);

			// Execute operation that succeeds
			const result = await transactionInfo.tx(async () => {
				return { success: true, data: "test" };
			});

			expect(result).toEqual({ success: true, data: "test" });
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(0);
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(0);
		});

		it("should rollback transaction when operation throws error and transaction was created", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			expect(transactionInfo.isTransactionCreated).toBe(true);

			// Execute operation that throws error
			await expect(
				transactionInfo.tx(async () => {
					throw new Error("Operation failed");
				}),
			).rejects.toThrow("Operation failed");

			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(1);
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledWith(
				"test-transaction-id",
			);
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(0);
		});

		it("should not rollback transaction when operation throws error but transaction was not created", async () => {
			const existingTransactionID = "existing-transaction-id";
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve(null)),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload, {
				transactionID: existingTransactionID,
			});

			expect(transactionInfo.isTransactionCreated).toBe(false);

			// Execute operation that throws error
			await expect(
				transactionInfo.tx(async () => {
					throw new Error("Operation failed");
				}),
			).rejects.toThrow("Operation failed");

			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(0);
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(0);
		});

		it("should handle synchronous operations", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			// Execute synchronous operation
			const result = await transactionInfo.tx(() => {
				return { success: true, data: "sync-result" };
			});

			expect(result).toEqual({ success: true, data: "sync-result" });
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(1);
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(0);
		});

		it("should pass transactionInfo to operation", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			let receivedTransactionInfo: Omit<
				HandleTransactionIdResult,
				"tx"
			> | null = null;

			await transactionInfo.tx(async (info) => {
				receivedTransactionInfo = info;
				return { success: true };
			});

			expect(receivedTransactionInfo).not.toBeNull();
			// @ts-ignore
			expect(receivedTransactionInfo?.transactionID).toBe(
				"test-transaction-id",
			);
			// @ts-ignore
			expect(receivedTransactionInfo?.isTransactionCreated).toBe(true);
			// @ts-ignore
			expect(receivedTransactionInfo?.reqWithTransaction).toHaveProperty(
				"transactionID",
				"test-transaction-id",
			);
		});
	});

	describe("shouldRollback parameter", () => {
		it("should rollback transaction when shouldRollback returns true", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			const result = await transactionInfo.tx(
				async () => {
					return { success: false, error: "Validation failed" };
				},
				(result) => result.success === false,
			);

			expect(result).toEqual({ success: false, error: "Validation failed" });
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(1);
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledWith(
				"test-transaction-id",
			);
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(0);
		});

		it("should commit transaction when shouldRollback returns false", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			const result = await transactionInfo.tx(
				async () => {
					return { success: true, data: "test" };
				},
				(result) => result.success === false,
			);

			expect(result).toEqual({ success: true, data: "test" });
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(1);
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledWith(
				"test-transaction-id",
			);
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(0);
		});

		it("should commit transaction when shouldRollback is not provided", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			const result = await transactionInfo.tx(async () => {
				return { success: false, error: "Validation failed" };
			});

			expect(result).toEqual({ success: false, error: "Validation failed" });
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(1);
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(0);
		});

		it("should not rollback when shouldRollback returns true but transaction was not created", async () => {
			const existingTransactionID = "existing-transaction-id";
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve(null)),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload, {
				transactionID: existingTransactionID,
			});

			const result = await transactionInfo.tx(
				async () => {
					return { success: false, error: "Validation failed" };
				},
				(result) => result.success === false,
			);

			expect(result).toEqual({ success: false, error: "Validation failed" });
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(0);
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(0);
		});

		it("should await result before checking shouldRollback", async () => {
			const mockPayload = {
				db: {
					beginTransaction: mock(() => Promise.resolve("test-transaction-id")),
					commitTransaction: mock(() => Promise.resolve()),
					rollbackTransaction: mock(() => Promise.resolve()),
				},
			} as unknown as Payload;

			const transactionInfo = await handleTransactionId(mockPayload);

			// Operation returns a Promise
			const result = await transactionInfo.tx(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					return Promise.resolve({ success: false });
				},
				(result) => result.success === false,
			);

			expect(result).toEqual({ success: false });
			expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledTimes(1);
			expect(mockPayload.db.commitTransaction).toHaveBeenCalledTimes(0);
		});
	});
});
