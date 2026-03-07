import { HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { sql } from "@payloadcms/db-postgres/drizzle";
import { envVars } from "./env";
import { s3Client } from "./s3-client";
import type { Payload } from "payload";

async function testDbConnection(
	payload: Payload,
) {
	try {
		await payload.db.drizzle.execute(sql`SELECT 1`);
		payload.logger.info("✅ Database connection successful");
		return true;
	} catch (error) {
		payload.logger.error("❌ Database connection failed");
		if (error instanceof Error) {
			payload.logger.error(`   ${error.message}`);
		}
		return false;
	}
}

async function ensureBucket({
	logger,
}: {
	logger: Payload["logger"],
}): Promise<void> {
	try {
		await s3Client.send(
			new HeadBucketCommand({
				Bucket: envVars.S3_BUCKET.value,
			}),
		);
		logger.info(`Bucket ${envVars.S3_BUCKET.value} already exists`);
		return;
	} catch {
		// Bucket does not exist, create it
	}

	try {
		await s3Client.send(
			new CreateBucketCommand({
				Bucket: envVars.S3_BUCKET.value,
			}),
		);
		logger.info(`Created bucket ${envVars.S3_BUCKET.value}`);
	} catch (error) {
		const err = error as { name?: string; Code?: string };
		if (
			err.name === "BucketAlreadyOwnedByYou" ||
			err.Code === "BucketAlreadyOwnedByYou" ||
			err.name === "BucketAlreadyExists" ||
			err.Code === "BucketAlreadyExists"
		) {
			logger.info(`Bucket ${envVars.S3_BUCKET.value} already exists`);
			return;
		}
		throw error;
	}
}

async function testS3Connection({
	logger,
}: {
	logger: Payload["logger"],
}): Promise<
	{ ok: true } | { ok: false; error: unknown }
> {
	try {
		const bucket = envVars.S3_BUCKET.value;
		if (!bucket) {
			logger.warn("⚠️  S3_BUCKET not set, skipping S3 connection test");
			return { ok: true };
		}
		await s3Client.send(
			new HeadBucketCommand({
				Bucket: bucket,
			}),
		);
		logger.info("✅ S3 connection successful");
		return { ok: true };
	} catch (error) {
		logger.error("❌ S3 connection failed");
		if (error instanceof Error) {
			logger.error(`   ${error.message}`);
		}
		return { ok: false, error };
	}
}

export async function testConnections(
	payload: Payload,
) {
	payload.logger.info("🔍 Testing dependencies connectivity...");

	const dbOk = await testDbConnection(payload);

	// Ensure bucket exists before testing S3 connection
	try {
		await ensureBucket({ logger: payload.logger });
	} catch (error) {
		payload.logger.error("❌ Failed to ensure S3 bucket");
		if (error instanceof Error) {
			payload.logger.error(`   ${error.message}`);
		}
	}

	const s3Result = await testS3Connection({ logger: payload.logger });

	if (!dbOk || !s3Result.ok) {
		payload.logger.error("❌ One or more dependency connections failed. Exiting.");
		process.exit(1);
	}

	payload.logger.info("✅ All dependencies connected successfully");
}
