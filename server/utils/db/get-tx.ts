import type { Payload } from "payload";

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
	return payload.db.sessions![transactionID].db as Parameters<
		Parameters<T["db"]["drizzle"]["transaction"]>[0]
	>[0];
}
