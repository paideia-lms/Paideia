import { describe, expect, test } from "bun:test";
import { EnrolmentModule } from "../index";

describe("Enrolment Module", () => {
	test("should be defined", () => {
		expect(EnrolmentModule).toBeDefined();
	});
});
