import { describe, expect, test } from "bun:test";
import type { TreeNode } from "./course-structure-tree";
import { calculateMoveOperation } from "./calculate-move-operation";

describe("calculateMoveOperation", () => {
	// Create mock flat data for testing
	const createMockFlatData = (): Record<string, TreeNode> => ({
		root: {
			id: "root",
			name: "Root",
			type: "section",
			children: ["s1", "s2"],
		},
		s1: {
			id: "s1",
			name: "Section 1",
			type: "section",
			contentOrder: 0,
			children: ["m1", "s3"],
		},
		s2: {
			id: "s2",
			name: "Section 2",
			type: "section",
			contentOrder: 1,
			children: ["m2"],
		},
		s3: {
			id: "s3",
			name: "Section 3",
			type: "section",
			contentOrder: 2,
			children: [],
		},
		m1: {
			id: "m1",
			name: "Module 1",
			type: "module",
			contentOrder: 0,
			module: {
				id: 1,
				title: "Module 1",
				type: "page",
				status: "published",
			},
		},
		m2: {
			id: "m2",
			name: "Module 2",
			type: "module",
			contentOrder: 1,
			module: {
				id: 2,
				title: "Module 2",
				type: "quiz",
				status: "draft",
			},
		},
	});

	test("should return null for multiple item moves", () => {
		const flatData = createMockFlatData();
		const getChildren = (itemId: string) => flatData[itemId]?.children || [];
		const result = calculateMoveOperation(
			{
				dragIds: ["s1", "s2"],
				targetId: null,
				targetInsertionIndex: 0,
				targetChildIndex: undefined,
			},
			getChildren,
		);
		expect(result).toBeNull();
	});

	test("should handle moving section into another section", () => {
		const flatData = createMockFlatData();
		const getChildren = (itemId: string) => flatData[itemId]?.children || [];
		const result = calculateMoveOperation(
			{
				dragIds: ["s2"],
				targetId: "s1",
				targetInsertionIndex: undefined,
				targetChildIndex: undefined,
			},
			getChildren,
		);

		expect(result).toEqual({
			sourceType: "section",
			sourceId: 2,
			targetType: "section",
			targetId: 1,
			location: "inside",
		});
	});

	test("should handle moving module above another module", () => {
		const flatData = createMockFlatData();
		const getChildren = (itemId: string) => flatData[itemId]?.children || [];
		const result = calculateMoveOperation(
			{
				dragIds: ["m2"],
				targetId: "s2",
				targetInsertionIndex: 0,
				targetChildIndex: undefined,
			},
			getChildren,
		);

		expect(result).toEqual({
			sourceType: "activity-module",
			sourceId: 2,
			targetType: "section",
			targetId: 2,
			location: "inside",
		});
	});

	test("should handle moving to end of children list", () => {
		const flatData = createMockFlatData();
		const getChildren = (itemId: string) => flatData[itemId]?.children || [];
		const result = calculateMoveOperation(
			{
				dragIds: ["m2"],
				targetId: "s1",
				targetInsertionIndex: 2,
				targetChildIndex: undefined,
			},
			getChildren,
		);

		expect(result).toEqual({
			sourceType: "activity-module",
			sourceId: 2,
			targetType: "section",
			targetId: 3,
			location: "below",
		});
	});
});
