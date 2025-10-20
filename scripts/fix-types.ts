const payloadTypesPath = "server/payload-types.ts";
const shim = 'import * as Schemas from "./utils/schema";';
const name = "Schemas";

const payloadTypes = await Bun.file(payloadTypesPath).text();

// look for string that prefix with '$fix:${$1}' and replace with the string after the :
// console.log all the matches
const matches = payloadTypes.match(/'\$fix:(\w+)'/g);

// console.log(matches);
console.log(`✨ Fixing types...`);
console.log(`✨ Found ${matches?.length} matches`);
console.log(`✨ Replacing with ${matches?.join(", ")}`);

// replace all the matches with the string after the :
const fixedPayloadTypes = payloadTypes.replace(/'\$fix:(\w+)'/g, `${name}.$1`);

// write the fixed payload types to server/payload-types.ts
await Bun.write(
	payloadTypesPath,
	`${shim}
${fixedPayloadTypes}
`,
);

console.log(`✨ Fixed types`);

// read payload-generated-schema.ts and add // @ts-nocheck to the file
const payloadGeneratedSchema = await Bun.file(
	"src/payload-generated-schema.ts",
).text();
const startWithTsCheck = payloadGeneratedSchema.startsWith("// @ts-nocheck");
if (!startWithTsCheck) {
	await Bun.write(
		"src/payload-generated-schema.ts",
		`// @ts-nocheck\n${payloadGeneratedSchema}`,
	);
}
