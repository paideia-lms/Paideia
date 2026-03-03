import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { sql } from "@payloadcms/db-postgres/drizzle";
import { ensureBucket } from "../scripts/ensure-s3-bucket";
import { envVars } from "./env";
import { s3Client } from "./utils/s3-client";

export async function testDbConnection(
	payload: Awaited<ReturnType<typeof import("payload").getPayload>>,
) {
	try {
		await payload.db.drizzle.execute(sql`SELECT 1`);
		console.log("✅ Database connection successful");
		return true;
	} catch (error) {
		console.error("❌ Database connection failed:");
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
		}
		return false;
	}
}

export async function testS3Connection(): Promise<
	{ ok: true } | { ok: false; error: unknown }
> {
	try {
		const bucket = envVars.S3_BUCKET.value;
		if (!bucket) {
			console.warn("⚠️  S3_BUCKET not set, skipping S3 connection test");
			return { ok: true };
		}
		await s3Client.send(
			new HeadBucketCommand({
				Bucket: bucket,
			}),
		);
		console.log("✅ S3 connection successful");
		return { ok: true };
	} catch (error) {
		console.error("❌ S3 connection failed:");
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
		}
		return { ok: false, error };
	}
}

export async function testConnections(
	payload: Awaited<ReturnType<typeof import("payload").getPayload>>,
) {
	console.log("\n🔍 Testing dependencies connectivity...\n");

	const dbOk = await testDbConnection(payload);

	// Ensure bucket exists before testing S3 connection
	try {
		await ensureBucket();
	} catch (error) {
		console.error("❌ Failed to ensure S3 bucket:");
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
		}
	}

	const s3Result = await testS3Connection();

	if (!dbOk || !s3Result.ok) {
		console.error("\n❌ One or more dependency connections failed. Exiting.\n");
		process.exit(1);
	}

	console.log("\n✅ All dependencies connected successfully\n");
}
