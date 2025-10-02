// test uplaod files to minio directly using s3 client

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "./server/payload.config";

await $`bun run migrate:fresh --force-accept-warning`;

// const s3Client = new S3Client({
//     region: "us-east-1",
//     credentials: {
//         accessKeyId: "paideia_minio",
//         secretAccessKey: "paideia_minio_secret",
//     },
//     endpoint: "http://localhost:9000",
//     forcePathStyle: true,
// });

// const command = new PutObjectCommand({
//     Bucket: "paideia-bucket",
//     Key: "test.txt",
//     Body: "Hello, world!",
// });

// const result = await s3Client.send(command);

// console.log(result);

// try using the payload client to upload a file

const payload = await getPayload({
	config: sanitizedConfig,
});

const imageBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
const imageBufferLength = imageBuffer.byteLength;

const result2 = await payload.create({
	collection: "media",
	data: {
		filename: "gem.png",
		mimeType: "image/png",
	},
	file: {
		data: Buffer.from(imageBuffer),
		name: "gem.png",
		size: imageBufferLength,
		mimetype: "image/png",
	},
});

console.log(result2);

process.exit(0);
