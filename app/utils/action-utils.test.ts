import { describe, expect, test } from "bun:test";
import {
	MyFormData,
	convertMyFormDataToObject,
	normalizeBlobRef,
} from "./action-utils";

describe("MyFormData", () => {
	test("should create FormData with string values", () => {
		const data = {
			name: "John Doe",
			email: "john@example.com",
		};

		const formData = new MyFormData(data);

		// Strings are JSON stringified to handle edge cases like string "null"
		expect(formData.get("name")).toBe('"John Doe"');
		expect(formData.get("email")).toBe('"john@example.com"');
	});

	test("should create FormData with File values", () => {
		const file = new File(["test content"], "test.txt", {
			type: "text/plain",
		});

		const data = {
			file,
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		// Files are stored separately and restored via json()
		expect(result.file).toBeInstanceOf(File);
		expect((result.file as File).name).toBe("test.txt");
	});

	test("should create FormData with number values", () => {
		const data = {
			age: 30,
			score: 100,
			price: 99.99,
		};

		const formData = new MyFormData(data);

		expect(formData.get("age")).toBe("30");
		expect(formData.get("score")).toBe("100");
		expect(formData.get("price")).toBe("99.99");
	});

	test("should create FormData with boolean values", () => {
		const data = {
			isActive: true,
			isVerified: false,
		};

		const formData = new MyFormData(data);

		expect(formData.get("isActive")).toBe("true");
		expect(formData.get("isVerified")).toBe("false");
	});

	test("should create FormData with object values", () => {
		const data = {
			metadata: { age: 30, city: "New York" },
		};

		const formData = new MyFormData(data);

		expect(formData.get("metadata")).toBe('{"age":30,"city":"New York"}');
	});

	test("should create FormData with array values", () => {
		const data = {
			tags: ["tag1", "tag2", "tag3"],
		};

		const formData = new MyFormData(data);

		expect(formData.get("tags")).toBe('["tag1","tag2","tag3"]');
	});

	test("should create FormData with mixed string and File values", () => {
		const file = new File(["test content"], "test.txt", {
			type: "text/plain",
		});

		const data = {
			name: "John Doe",
			file,
			email: "john@example.com",
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		// Strings are JSON stringified
		expect(result.name).toBe("John Doe");
		expect(result.email).toBe("john@example.com");
		expect(result.file).toBeInstanceOf(File);
		expect((result.file as File).name).toBe("test.txt");
	});

	test("should create FormData with all primitive types", () => {
		const file = new File(["test content"], "test.txt", {
			type: "text/plain",
		});

		const data = {
			name: "John Doe",
			age: 30,
			isActive: true,
			metadata: { city: "New York" },
			tags: ["tag1", "tag2"],
			file,
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		// Strings are JSON stringified
		expect(result.name).toBe("John Doe");
		expect(result.age).toBe(30);
		expect(result.isActive).toBe(true);
		expect(result.metadata).toEqual({ city: "New York" });
		expect(result.tags).toEqual(["tag1", "tag2"]);
		expect(result.file).toBeInstanceOf(File);
		expect((result.file as File).name).toBe("test.txt");
	});

	test("should convert FormData back to object with json() method", () => {
		const data = {
			name: "John Doe",
			email: "john@example.com",
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result).toEqual(data);
	});

	test("should parse objects back from JSON strings in json() method", () => {
		const data = {
			name: "John Doe",
			metadata: { age: 30, city: "New York" },
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.name).toBe("John Doe");
		expect(result.metadata).toEqual({ age: 30, city: "New York" });
	});

	test("should parse arrays back from JSON strings in json() method", () => {
		const data = {
			tags: ["tag1", "tag2", "tag3"],
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
	});

	test("should parse numbers back from string in json() method", () => {
		const data = {
			age: 30,
			score: 100,
			price: 99.99,
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.age).toBe(30);
		expect(result.score).toBe(100);
		expect(result.price).toBe(99.99);
	});

	test("should parse booleans back from string in json() method", () => {
		const data = {
			isActive: true,
			isVerified: false,
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.isActive).toBe(true);
		expect(result.isVerified).toBe(false);
	});

	test("should parse JSON stringified strings back correctly in json() method", () => {
		const data = {
			name: "John Doe",
			description: "This is not JSON",
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.name).toBe("John Doe");
		expect(result.description).toBe("This is not JSON");
	});

	test("should handle File objects in json() method", () => {
		const file = new File(["test content"], "test.txt", {
			type: "text/plain",
		});

		const data = {
			name: "John Doe",
			file,
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.name).toBe("John Doe");
		expect(result.file).toBeInstanceOf(File);
		expect((result.file as File).name).toBe("test.txt");
	});

	test("should handle empty object", () => {
		const data = {};

		const formData = new MyFormData(data);

		// Empty FormData should have a dummy field to prevent fetch errors
		expect(formData.get("__empty__")).toBe("true");

		const result = formData.json();

		// The dummy field should be filtered out in the result
		expect(result).toEqual({});
		expect("__empty__" in result).toBe(false);
	});

	test("should handle complex nested objects", () => {
		const data = {
			users: [
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			],
			settings: { theme: "dark", notifications: true },
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.users).toEqual([
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
		]);
		expect(result.settings).toEqual({ theme: "dark", notifications: true });
	});

	test("should handle strings that look like invalid JSON gracefully", () => {
		const data = {
			name: "John Doe",
			invalidJson: "{ invalid json }",
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.name).toBe("John Doe");
		// The string is JSON stringified, so it's stored as "\"{ invalid json }\""
		// and parsed back correctly
		expect(result.invalidJson).toBe("{ invalid json }");
	});

	test("should send null as special marker to distinguish from undefined", () => {
		const data = {
			name: "John Doe",
			category: null,
			email: "john@example.com",
		};

		const formData = new MyFormData(data);

		expect(formData.get("name")).toBe('"John Doe"'); // Strings are JSON stringified
		expect(formData.get("email")).toBe('"john@example.com"');
		expect(formData.get("category")).toBe("\0__FORM_NULL__\0"); // Special marker
	});

	test("should skip undefined values at top level", () => {
		const data: {
			name: string;
			category?: string;
			email: string;
		} = {
			name: "John Doe",
			email: "john@example.com",
		};

		const formData = new MyFormData(data);

		expect(formData.get("name")).toBe('"John Doe"');
		expect(formData.get("email")).toBe('"john@example.com"');
		expect(formData.get("category")).toBeNull(); // undefined is not in FormData
	});

	test("should parse null back from marker in json() method", () => {
		const data = {
			name: "John Doe",
			category: null,
			email: "john@example.com",
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.name).toBe("John Doe");
		expect(result.email).toBe("john@example.com");
		expect(result.category).toBeNull();
	});

	test("should distinguish between null, undefined, and string 'null'", () => {
		const dataWithNull = {
			name: "John",
			category: null as string | null,
		};

		const dataWithUndefined = {
			name: "John",
			category: undefined as string | undefined,
		};

		const dataWithStringNull = {
			name: "John",
			category: "null" as string, // The actual string "null"
		};

		const formDataNull = new MyFormData(dataWithNull);
		const formDataUndefined = new MyFormData(dataWithUndefined);
		const formDataStringNull = new MyFormData(dataWithStringNull);

		// null should be present as special marker
		expect(formDataNull.get("category")).toBe("\0__FORM_NULL__\0");

		// undefined should be absent
		expect(formDataUndefined.get("category")).toBeNull();

		// string "null" should be JSON stringified
		expect(formDataStringNull.get("category")).toBe('"null"');

		// Verify round-trip
		const resultNull = formDataNull.json();
		expect(resultNull.category).toBeNull();

		// For undefined, the key won't exist in the result
		const resultUndefined = formDataUndefined.json();
		expect("category" in resultUndefined).toBe(false);

		// String "null" should remain as string
		const resultStringNull = formDataStringNull.json();
		expect(resultStringNull.category).toBe("null");
	});

	test("should handle string 'null' correctly", () => {
		const data = {
			value: "null", // User wants to send the literal string "null"
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.value).toBe("null"); // Should remain as string, not become null
		expect(typeof result.value).toBe("string");
	});

	test("should handle null values in objects", () => {
		const data = {
			metadata: { value: null, other: "test" },
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.metadata).toEqual({ value: null, other: "test" });
	});

	test("should handle zero and negative numbers", () => {
		const data = {
			zero: 0,
			negative: -10,
			negativeFloat: -99.99,
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.zero).toBe(0);
		expect(result.negative).toBe(-10);
		expect(result.negativeFloat).toBe(-99.99);
	});

	test("should handle empty arrays and objects", () => {
		const data = {
			emptyArray: [],
			emptyObject: {},
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.emptyArray).toEqual([]);
		expect(result.emptyObject).toEqual({});
	});

	test("should round-trip all primitive types correctly", () => {
		const file = new File(["test content"], "test.txt", {
			type: "text/plain",
		});

		const data = {
			string: "hello",
			number: 42,
			boolean: true,
			object: { nested: "value" },
			array: [1, 2, 3],
			file,
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		expect(result.string).toBe("hello");
		expect(result.number).toBe(42);
		expect(result.boolean).toBe(true);
		expect(result.object).toEqual({ nested: "value" });
		expect(result.array).toEqual([1, 2, 3]);
		expect(result.file).toBeInstanceOf(File);
		expect((result.file as File).name).toBe("test.txt");
	});

	test("should handle array of Blobs", () => {
		const file1 = new File(["content 1"], "file1.txt", {
			type: "text/plain",
		});
		const file2 = new File(["content 2"], "file2.txt", {
			type: "text/plain",
		});
		const file3 = new File(["content 3"], "file3.txt", {
			type: "text/plain",
		});

		const data = {
			files: [file1, file2, file3],
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		// Arrays are JSON stringified, but Blobs serialize as empty objects
		expect(Array.isArray(result.files)).toBe(true);
		expect(result.files.length).toBe(3);
		// Blobs are serialized as empty objects when JSON stringified
		expect(result.files[0]).toBeInstanceOf(File);
		expect(result.files[1]).toBeInstanceOf(File);
		expect(result.files[2]).toBeInstanceOf(File);
	});

	test("should handle array of arrays of Blobs", () => {
		const file1 = new File(["content 1"], "file1.txt", {
			type: "text/plain",
		});
		const file2 = new File(["content 2"], "file2.txt", {
			type: "text/plain",
		});
		const file3 = new File(["content 3"], "file3.txt", {
			type: "text/plain",
		});
		const file4 = new File(["content 4"], "file4.txt", {
			type: "text/plain",
		});

		const data = {
			fileGroups: [
				[file1, file2],
				[file3, file4],
			],
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		// Nested arrays are JSON stringified, but Blobs serialize as empty objects
		expect(Array.isArray(result.fileGroups)).toBe(true);
		expect(result.fileGroups.length).toBe(2);
		expect(Array.isArray(result.fileGroups[0])).toBe(true);
		expect(Array.isArray(result.fileGroups[1])).toBe(true);
		expect(result.fileGroups[0]!.length).toBe(2);
		expect(result.fileGroups[1]!.length).toBe(2);
		// Blobs are serialized as empty objects when JSON stringified
		expect(result.fileGroups[0]![0]).toBeInstanceOf(File);
		expect(result.fileGroups[0]![1]).toBeInstanceOf(File);
		expect(result.fileGroups[1]![0]).toBeInstanceOf(File);
		expect(result.fileGroups[1]![1]).toBeInstanceOf(File);
	});

	test("should round-trip array of Blobs in json() method", () => {
		const file1 = new File(["content 1"], "file1.txt", {
			type: "text/plain",
		});
		const file2 = new File(["content 2"], "file2.txt", {
			type: "text/plain",
		});

		const data = {
			files: [file1, file2],
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		// When round-tripping, Blobs in arrays are lost because they serialize as {}
		expect(Array.isArray(result.files)).toBe(true);
		expect(result.files.length).toBe(2);
		expect(result.files[0]).toBeInstanceOf(File);
		expect(result.files[1]).toBeInstanceOf(File);
	});

	test("should round-trip array of arrays of Blobs in json() method", () => {
		const file1 = new File(["content 1"], "file1.txt", {
			type: "text/plain",
		});
		const file2 = new File(["content 2"], "file2.txt", {
			type: "text/plain",
		});
		const file3 = new File(["content 3"], "file3.txt", {
			type: "text/plain",
		});

		const data = {
			fileGroups: [[file1, file2], [file3]],
		};

		const formData = new MyFormData(data);
		const result = formData.json();

		// When round-tripping, Blobs in nested arrays are lost because they serialize as {}
		expect(Array.isArray(result.fileGroups)).toBe(true);
		expect(result.fileGroups.length).toBe(2);
		expect(Array.isArray(result.fileGroups[0])).toBe(true);
		expect(Array.isArray(result.fileGroups[1])).toBe(true);
		expect(result.fileGroups[0]!.length).toBe(2);
		expect(result.fileGroups[1]!.length).toBe(1);
		expect(result.fileGroups[0]![0]).toBeInstanceOf(File);
		expect(result.fileGroups[0]![1]).toBeInstanceOf(File);
		expect(result.fileGroups[1]![0]).toBeInstanceOf(File);
	});
});

describe("convertMyFormDataToObject", () => {
	test("should convert MyFormData to object", () => {
		const data = {
			name: "John Doe",
			age: 30,
			isActive: true,
		};

		const formData = new MyFormData(data);
		const result = convertMyFormDataToObject(formData);

		expect(result.name).toBe("John Doe");
		expect(result.age).toBe(30);
		expect(result.isActive).toBe(true);
	});

	test("should convert regular FormData to object", () => {
		const formData = new FormData();
		formData.append("name", '"John Doe"'); // JSON stringified
		formData.append("age", "30");
		formData.append("isActive", "true");

		const result = convertMyFormDataToObject(formData);

		expect(result.name).toBe("John Doe");
		expect(result.age).toBe(30);
		expect(result.isActive).toBe(true);
	});

	test("should handle NULL_MARKER in regular FormData", () => {
		const formData = new MyFormData({
			name: "John Doe",
			category: null,
		});
		const result = formData.json();

		expect(result.name).toBe("John Doe");
		expect(result.category).toBeNull();
	});

	test("should handle Files in regular FormData", () => {
		const file = new File(["test content"], "test.txt", {
			type: "text/plain",
		});

		const formData = new MyFormData({
			name: "John Doe",
			file,
		});
		const result = formData.json();

		expect(result.name).toBe("John Doe");
		expect(result.file).toBeInstanceOf(File);
		expect((result.file as File).name).toBe("test.txt");
	});

	test("should handle JSON stringified values in regular FormData", () => {
		const formData = new MyFormData({
			metadata: { age: 30, city: "New York" },
			tags: ["tag1", "tag2"],
		});
		const result = formData.json();

		expect(result.metadata).toEqual({ age: 30, city: "New York" });
		expect(result.tags).toEqual(["tag1", "tag2"]);
	});

	test("should handle non-JSON strings in regular FormData", () => {
		const formData = new MyFormData({
			plain: "not json",
		});
		formData.append("plain", "not json");

		const result = formData.json();

		expect(result.plain).toBe("not json");
	});

	test("should produce same result as MyFormData.json()", () => {
		const data = {
			name: "John Doe",
			age: 30,
			category: null,
			metadata: { city: "New York" },
		};

		const myFormData = new MyFormData(data);
		const result1 = myFormData.json();
		const result2 = convertMyFormDataToObject<typeof data>(myFormData);

		expect(result1).toEqual(result2);
		expect(result1.name).toBe("John Doe");
		expect(result1.age).toBe(30);
		expect(result1.category).toBeNull();
		expect(result1.metadata).toEqual({ city: "New York" });
	});

	test("should handle empty FormData and filter out dummy field", () => {
		const formData = new FormData();
		formData.append("__empty__", "true");

		const result = convertMyFormDataToObject(formData);

		expect(result).toEqual({});
		expect("__empty__" in result).toBe(false);
	});

	test("should handle FormData with only dummy field and other fields", () => {
		const formData = new FormData();
		formData.append("__empty__", "true");
		formData.append("name", '"John Doe"');

		const result = convertMyFormDataToObject(formData);

		expect(result.name).toBe("John Doe");
		expect("__empty__" in result).toBe(false);
	});

	test("should handle nested blobs in object", () => {
		const formData = new MyFormData({
			metadata: {
				image: {
					test: new File(["test content"], "test.txt", {
						type: "image/png",
					}),
				},
			},
		});
		const result = formData.json();

		expect(result.metadata).toEqual({
			image: {
				test: new File(["test content"], "test.txt", {
					type: "image/png",
				}),
			},
		});
	});
});

describe("normalizeBlobRef", () => {
	test("should normalize blob ref", () => {
		const data = "\0__BLOB_REF__:123";
		const result = normalizeBlobRef(data);
		expect(result).toBe("__BLOB_REF__:123");
	});

	test("should normalize blob ref with escaped null character", () => {
		const data = "\\u0000__BLOB_REF__:123";
		const result = normalizeBlobRef(data);
		expect(result).toBe("__BLOB_REF__:123");
	});

	test("should normalize blob ref with normalized key and escaped null character", () => {
		const data = "\u0000__BLOB_REF__:123";
		const result = normalizeBlobRef(data);
		expect(result).toBe("__BLOB_REF__:123");
	});

	test("should normalize blob ref with actual null character", () => {
		const data = "\0__BLOB_REF__:123";
		const result = normalizeBlobRef(data);
		expect(result).toBe("__BLOB_REF__:123");
	});
});
