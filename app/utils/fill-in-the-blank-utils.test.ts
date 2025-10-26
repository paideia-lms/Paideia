import { describe, expect, test } from "bun:test";
import {
    isValidBlankId,
    parseFillInTheBlank,
    splitPromptIntoParts,
} from "./fill-in-the-blank-utils";

describe("fill-in-the-blank-utils", () => {
    describe("isValidBlankId", () => {
        test("should accept valid snake_case IDs", () => {
            expect(isValidBlankId("capital")).toBe(true);
            expect(isValidBlankId("capital_city")).toBe(true);
            expect(isValidBlankId("first_name")).toBe(true);
            expect(isValidBlankId("my_long_variable_name")).toBe(true);
        });

        test("should accept valid CONSTANT_CASE IDs", () => {
            expect(isValidBlankId("MAX")).toBe(true);
            expect(isValidBlankId("MAX_VALUE")).toBe(true);
            expect(isValidBlankId("API_KEY")).toBe(true);
            expect(isValidBlankId("DATABASE_CONNECTION_STRING")).toBe(true);
        });

        test("should reject invalid IDs", () => {
            // camelCase
            expect(isValidBlankId("capitalCity")).toBe(false);
            expect(isValidBlankId("firstName")).toBe(false);

            // PascalCase
            expect(isValidBlankId("CapitalCity")).toBe(false);
            expect(isValidBlankId("FirstName")).toBe(false);

            // Mixed case
            expect(isValidBlankId("Capital_City")).toBe(false);
            expect(isValidBlankId("FIRST_name")).toBe(false);

            // Special characters
            expect(isValidBlankId("capital-city")).toBe(false);
            expect(isValidBlankId("capital.city")).toBe(false);
            expect(isValidBlankId("capital city")).toBe(false);

            // Numbers
            expect(isValidBlankId("capital1")).toBe(false);
            expect(isValidBlankId("1capital")).toBe(false);

            // Empty or underscore only
            expect(isValidBlankId("")).toBe(false);
            expect(isValidBlankId("_")).toBe(false);
            expect(isValidBlankId("__")).toBe(false);

            // Leading/trailing underscores
            expect(isValidBlankId("_capital")).toBe(false);
            expect(isValidBlankId("capital_")).toBe(false);
        });
    });

    describe("parseFillInTheBlank", () => {
        test("should parse simple single blank", () => {
            const result = parseFillInTheBlank("The capital is {{capital}}.");
            expect(result.blankIds).toEqual(["capital"]);
            expect(result.uniqueBlankIds).toEqual(["capital"]);
            expect(result.invalidBlankIds).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        test("should parse multiple different blanks", () => {
            const result = parseFillInTheBlank(
                "{{country}} has {{capital}} as its capital.",
            );
            expect(result.blankIds).toEqual(["country", "capital"]);
            expect(result.uniqueBlankIds).toEqual(["country", "capital"]);
            expect(result.invalidBlankIds).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        test("should handle repeated blank IDs", () => {
            const result = parseFillInTheBlank(
                "The capital is {{capital}} and the largest city is also {{capital}}.",
            );
            expect(result.blankIds).toEqual(["capital", "capital"]);
            expect(result.uniqueBlankIds).toEqual(["capital"]);
            expect(result.invalidBlankIds).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        test("should detect invalid blank IDs", () => {
            const result = parseFillInTheBlank(
                "The {{capitalCity}} is {{FirstName}}.",
            );
            expect(result.blankIds).toEqual(["capitalCity", "FirstName"]);
            expect(result.uniqueBlankIds).toEqual(["capitalCity", "FirstName"]);
            expect(result.invalidBlankIds).toEqual(["capitalCity", "FirstName"]);
            expect(result.isValid).toBe(false);
        });

        test("should handle mix of valid and invalid IDs", () => {
            const result = parseFillInTheBlank(
                "{{valid_id}} and {{invalidId}} and {{VALID_CONSTANT}}.",
            );
            expect(result.blankIds).toEqual([
                "valid_id",
                "invalidId",
                "VALID_CONSTANT",
            ]);
            expect(result.uniqueBlankIds).toEqual([
                "valid_id",
                "invalidId",
                "VALID_CONSTANT",
            ]);
            expect(result.invalidBlankIds).toEqual(["invalidId"]);
            expect(result.isValid).toBe(false);
        });

        test("should handle prompts with no blanks", () => {
            const result = parseFillInTheBlank("This is a simple sentence.");
            expect(result.blankIds).toEqual([]);
            expect(result.uniqueBlankIds).toEqual([]);
            expect(result.invalidBlankIds).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        test("should handle empty prompt", () => {
            const result = parseFillInTheBlank("");
            expect(result.blankIds).toEqual([]);
            expect(result.uniqueBlankIds).toEqual([]);
            expect(result.invalidBlankIds).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        test("should trim spaces around blank IDs", () => {
            const result = parseFillInTheBlank(
                "The capital is {{ capital }} and the city is {{  city  }}.",
            );
            expect(result.blankIds).toEqual(["capital", "city"]);
            expect(result.uniqueBlankIds).toEqual(["capital", "city"]);
            expect(result.invalidBlankIds).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        test("should treat blanks with spaces as same ID after trimming", () => {
            const result = parseFillInTheBlank(
                "{{capital}} and {{ capital }} and {{  capital  }}.",
            );
            expect(result.blankIds).toEqual(["capital", "capital", "capital"]);
            expect(result.uniqueBlankIds).toEqual(["capital"]);
            expect(result.invalidBlankIds).toEqual([]);
            expect(result.isValid).toBe(true);
        });
    });

    describe("splitPromptIntoParts", () => {
        test("should split prompt with single blank", () => {
            const parts = splitPromptIntoParts("The capital is {{capital}}.");
            expect(parts).toEqual([
                { type: "text", content: "The capital is " },
                { type: "blank", content: "capital" },
                { type: "text", content: "." },
            ]);
        });

        test("should split prompt with multiple blanks", () => {
            const parts = splitPromptIntoParts(
                "{{country}} has {{capital}} as capital.",
            );
            expect(parts).toEqual([
                { type: "blank", content: "country" },
                { type: "text", content: " has " },
                { type: "blank", content: "capital" },
                { type: "text", content: " as capital." },
            ]);
        });

        test("should handle prompt starting with blank", () => {
            const parts = splitPromptIntoParts("{{capital}} is in France.");
            expect(parts).toEqual([
                { type: "blank", content: "capital" },
                { type: "text", content: " is in France." },
            ]);
        });

        test("should handle prompt ending with blank", () => {
            const parts = splitPromptIntoParts("The capital is {{capital}}");
            expect(parts).toEqual([
                { type: "text", content: "The capital is " },
                { type: "blank", content: "capital" },
            ]);
        });

        test("should handle consecutive blanks", () => {
            const parts = splitPromptIntoParts("{{first}}{{second}}");
            expect(parts).toEqual([
                { type: "blank", content: "first" },
                { type: "blank", content: "second" },
            ]);
        });

        test("should handle prompt with no blanks", () => {
            const parts = splitPromptIntoParts("This is a simple sentence.");
            expect(parts).toEqual([
                { type: "text", content: "This is a simple sentence." },
            ]);
        });

        test("should handle empty prompt", () => {
            const parts = splitPromptIntoParts("");
            expect(parts).toEqual([]);
        });

        test("should handle repeated blank IDs", () => {
            const parts = splitPromptIntoParts(
                "{{capital}} and {{capital}} are the same.",
            );
            expect(parts).toEqual([
                { type: "blank", content: "capital" },
                { type: "text", content: " and " },
                { type: "blank", content: "capital" },
                { type: "text", content: " are the same." },
            ]);
        });

        test("should trim spaces around blank IDs", () => {
            const parts = splitPromptIntoParts(
                "The capital is {{ capital }} and the city is {{  city  }}.",
            );
            expect(parts).toEqual([
                { type: "text", content: "The capital is " },
                { type: "blank", content: "capital" },
                { type: "text", content: " and the city is " },
                { type: "blank", content: "city" },
                { type: "text", content: "." },
            ]);
        });

        test("should treat blanks with spaces as same ID after trimming", () => {
            const parts = splitPromptIntoParts(
                "{{capital}} and {{ capital }} are the same.",
            );
            expect(parts).toEqual([
                { type: "blank", content: "capital" },
                { type: "text", content: " and " },
                { type: "blank", content: "capital" },
                { type: "text", content: " are the same." },
            ]);
        });
    });
});

