import { describe, expect, it } from "bun:test";
import { WeightExceedsLimitError } from "~/utils/error";
import type { GradebookSetupItem } from "../gradebook-management";
import { validateGradebookWeights } from "./validate-gradebook-weights";

describe("validateGradebookWeights", () => {
	it("should pass when total weight equals exactly 100% with no auto-weighted items", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 50,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: 50,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should fail when total weight does not equal 100% with no auto-weighted items", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 50,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: 30,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).toThrow(WeightExceedsLimitError);

		try {
			validateGradebookWeights(items, "course level", null, "Test");
		} catch (error) {
			if (error instanceof WeightExceedsLimitError) {
				expect(error.message).toContain("total weight");
				expect(error.message).toContain("80.00%");
				expect(error.message).toContain("must equal exactly 100%");
			}
		}
	});

	it("should pass when specified weights <= 100% with auto-weighted items", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 50,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: null, // Auto-weighted
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should pass when specified weights equal 100% with auto-weighted items", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 100,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: null, // Auto-weighted
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should fail when specified weights exceed 100% with auto-weighted items", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 80,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: 30, // Total would be 110%
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 3,
				type: "manual_item",
				name: "Item 3",
				weight: null, // Auto-weighted
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).toThrow(WeightExceedsLimitError);

		try {
			validateGradebookWeights(items, "course level", null, "Test");
		} catch (error) {
			if (error instanceof WeightExceedsLimitError) {
				expect(error.message).toContain("total specified weight");
				expect(error.message).toContain("110.00%");
				expect(error.message).toContain("must not exceed 100%");
			}
		}
	});

	it("should filter out extra credit items from validation", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 50,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: 50,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 3,
				type: "manual_item",
				name: "Extra Credit Item",
				weight: 20, // Should be ignored
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
				extra_credit: true,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should skip validation when only extra credit items exist", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Extra Credit Item 1",
				weight: 20,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
				extra_credit: true,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Extra Credit Item 2",
				weight: 30,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
				extra_credit: true,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should validate nested categories recursively", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "category",
				name: "Category 1",
				weight: null,
				max_grade: null,
				min_grade: null,
				description: null,
				category_id: null,
				grade_items: [
					{
						id: 2,
						type: "manual_item",
						name: "Category Item 1",
						weight: 50,
						max_grade: 100,
						min_grade: 0,
						description: null,
						category_id: 1,
					},
					{
						id: 3,
						type: "manual_item",
						name: "Category Item 2",
						weight: 30, // Total would be 80%, should fail
						max_grade: 100,
						min_grade: 0,
						description: null,
						category_id: 1,
					},
				],
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).toThrow(WeightExceedsLimitError);

		try {
			validateGradebookWeights(items, "course level", null, "Test");
		} catch (error) {
			if (error instanceof WeightExceedsLimitError) {
				expect(error.message).toContain("course level > Category 1");
				expect(error.message).toContain("80.00%");
			}
		}
	});

	it("should validate multiple nested categories", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "category",
				name: "Category 1",
				weight: null,
				max_grade: null,
				min_grade: null,
				description: null,
				category_id: null,
				grade_items: [
					{
						id: 2,
						type: "manual_item",
						name: "Category 1 Item",
						weight: 50,
						max_grade: 100,
						min_grade: 0,
						description: null,
						category_id: 1,
					},
					{
						id: 3,
						type: "manual_item",
						name: "Category 1 Item 2",
						weight: 50,
						max_grade: 100,
						min_grade: 0,
						description: null,
						category_id: 1,
					},
				],
			},
			{
				id: 4,
				type: "category",
				name: "Category 2",
				weight: null,
				max_grade: null,
				min_grade: null,
				description: null,
				category_id: null,
				grade_items: [
					{
						id: 5,
						type: "manual_item",
						name: "Category 2 Item",
						weight: 40,
						max_grade: 100,
						min_grade: 0,
						description: null,
						category_id: 4,
					},
					{
						id: 6,
						type: "manual_item",
						name: "Category 2 Item 2",
						weight: 60,
						max_grade: 100,
						min_grade: 0,
						description: null,
						category_id: 4,
					},
				],
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should handle deeply nested categories", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "category",
				name: "Parent Category",
				weight: null,
				max_grade: null,
				min_grade: null,
				description: null,
				category_id: null,
				grade_items: [
					{
						id: 2,
						type: "category",
						name: "Child Category",
						weight: null,
						max_grade: null,
						min_grade: null,
						description: null,
						category_id: 1,
						grade_items: [
							{
								id: 3,
								type: "manual_item",
								name: "Deep Item",
								weight: 50,
								max_grade: 100,
								min_grade: 0,
								description: null,
								category_id: 2,
							},
							{
								id: 4,
								type: "manual_item",
								name: "Deep Item 2",
								weight: 30, // Should fail
								max_grade: 100,
								min_grade: 0,
								description: null,
								category_id: 2,
							},
						],
					},
				],
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).toThrow(WeightExceedsLimitError);

		try {
			validateGradebookWeights(items, "course level", null, "Test");
		} catch (error) {
			if (error instanceof WeightExceedsLimitError) {
				expect(error.message).toContain(
					"course level > Parent Category > Child Category",
				);
			}
		}
	});

	it("should handle empty items array", () => {
		const items: GradebookSetupItem[] = [];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should handle items with zero weight", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 0,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: 100,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
		];

		expect(() => {
			validateGradebookWeights(items, "course level", null, "Test");
		}).not.toThrow();
	});

	it("should use custom error message prefix", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 50,
				max_grade: 100,
				min_grade: 0,
				description: null,
				category_id: null,
			},
		];

		try {
			validateGradebookWeights(items, "course level", null, "Item creation");
		} catch (error) {
			if (error instanceof WeightExceedsLimitError) {
				expect(error.message).toContain("Item creation");
			}
		}
	});
});

