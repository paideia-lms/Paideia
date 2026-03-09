import { describe, expect, it } from "bun:test";
import {
	flattenGradebookCategories,
	type FlattenedCategory,
} from "./flatten-gradebook-categories";

describe("flattenGradebookCategories", () => {
	it("flattens a single category", () => {
		const items = [
			{
				type: "category",
				id: 1,
				name: "Assignments",
				grade_items: [],
			},
		];
		const result = flattenGradebookCategories(items);
		expect(result).toEqual<FlattenedCategory[]>([
			{
				id: 1,
				name: "Assignments",
				parentId: null,
				depth: 0,
				path: "Assignments",
			},
		]);
	});

	it("flattens nested categories with hierarchy", () => {
		const items = [
			{
				type: "category",
				id: 1,
				name: "Parent",
				grade_items: [
					{
						type: "category",
						id: 2,
						name: "Child",
						grade_items: [
							{
								type: "category",
								id: 3,
								name: "Grandchild",
								grade_items: [],
							},
						],
					},
				],
			},
		];
		const result = flattenGradebookCategories(items);
		expect(result).toEqual<FlattenedCategory[]>([
			{ id: 1, name: "Parent", parentId: null, depth: 0, path: "Parent" },
			{
				id: 2,
				name: "Child",
				parentId: 1,
				depth: 1,
				path: "Parent > Child",
			},
			{
				id: 3,
				name: "Grandchild",
				parentId: 2,
				depth: 2,
				path: "Parent > Child > Grandchild",
			},
		]);
	});

	it("skips non-category items", () => {
		const items = [
			{
				type: "manual_item",
				id: 1,
				name: "Not a category",
				grade_items: [],
			},
		];
		const result = flattenGradebookCategories(items);
		expect(result).toEqual([]);
	});
});
