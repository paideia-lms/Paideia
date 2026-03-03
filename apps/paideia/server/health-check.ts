import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { sql } from "@payloadcms/db-postgres/drizzle";
import { envVars } from "./env";
import { s3Client } from "./utils/s3-client";

export async function testDbConnection(payload: Awaited<ReturnType<typeof import("payload").getPayload>>) {
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

export async function testS3Connection() {
	try {
		const bucket = envVars.S3_BUCKET.value;
		if (!bucket) {
			console.warn("⚠️  S3_BUCKET not set, skipping S3 connection test");
			return true;
		}
		await s3Client.send(
			new HeadBucketCommand({
				Bucket: bucket,
			}),
		);
		console.log("✅ S3 connection successful");
		return true;
	} catch (error) {
		console.error("❌ S3 connection failed:");
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
		}
		return false;
	}
}

export async function testConnections(payload: Awaited<ReturnType<typeof import("payload").getPayload>>) {
	console.log("\n🔍 Testing dependencies connectivity...\n");

	const dbOk = await testDbConnection(payload);
	const s3Ok = await testS3Connection();

	if (!dbOk || !s3Ok) {
		console.error("\n❌ One or more dependency connections failed. Exiting.\n");
		process.exit(1);
	}

	console.log("\n✅ All dependencies connected successfully\n");
}
