import { describe, expect, test } from "bun:test";
import type { CourseStructure } from "../internal/course-section-management";
import {
	generateCourseStructureTree,
	generateSimpleCourseStructureTree,
} from "./course-structure-tree";

describe("Course Structure Tree Generation", () => {
	test("should generate detailed tree with order information", () => {
		const courseStructure: CourseStructure = {
			courseId: 1,
			sections: [
				{
					id: 1,
					title: "Section A",
					description: "First section",
					contentOrder: 0,
					type: "section",
					content: [
						{
							id: 101,
							type: "activity-module",
							contentOrder: 1,
							module: {
								id: 101,
								title: "Activity Module 101",
								type: "page",
							},
						},
						{
							id: 2,
							title: "Section A.1",
							description: "Subsection A.1",
							contentOrder: 2,
							type: "section",
							content: [
								{
									id: 102,
									type: "activity-module",
									contentOrder: 1,
									module: {
										id: 102,
										title: "Activity Module 102",
										type: "assignment",
									},
								},
								{
									id: 103,
									type: "activity-module",
									contentOrder: 2,
									module: {
										id: 103,
										title: "Activity Module 103",
										type: "quiz",
									},
								},
							],
						},
						{
							id: 104,
							type: "activity-module",
							contentOrder: 3,
							module: {
								id: 104,
								title: "Activity Module 104",
								type: "discussion",
							},
						},
					],
				},
				{
					id: 3,
					title: "Section B",
					description: "Second section",
					contentOrder: 0,
					type: "section",
					content: [
						{
							id: 105,
							type: "activity-module",
							contentOrder: 1,
							module: {
								id: 105,
								title: "Activity Module 105",
								type: "whiteboard",
							},
						},
					],
				},
			],
		};

		const result = generateCourseStructureTree(courseStructure, "Test Course");

		expect(result).toContain("Test Course");
		expect(result).toContain("Section A (contentOrder: 0)");
		expect(result).toContain("Activity Module 101 (contentOrder: 1)");
		expect(result).toContain("Section A.1 (contentOrder: 2)");
		expect(result).toContain("Activity Module 102 (contentOrder: 1)");
		expect(result).toContain("Activity Module 103 (contentOrder: 2)");
		expect(result).toContain("Activity Module 104 (contentOrder: 3)");
		expect(result).toContain("Section B (contentOrder: 0)");
		expect(result).toContain("Activity Module 105 (contentOrder: 1)");

		// Verify tree structure characters
		expect(result).toContain("├──");
		expect(result).toContain("└──");
		expect(result).toContain("│   ");
	});

	test("should generate simple tree without order information", () => {
		const courseStructure: CourseStructure = {
			courseId: 1,
			sections: [
				{
					id: 1,
					title: "Introduction",
					description: "Course introduction",
					contentOrder: 0,
					type: "section",
					content: [
						{
							id: 201,
							type: "activity-module",
							contentOrder: 1,
							module: {
								id: 201,
								title: "Activity Module 201",
								type: "page",
							},
						},
						{
							id: 2,
							title: "Chapter 1",
							description: "First chapter",
							contentOrder: 2,
							type: "section",
							content: [
								{
									id: 202,
									type: "activity-module",
									contentOrder: 1,
									module: {
										id: 202,
										title: "Activity Module 202",
										type: "assignment",
									},
								},
							],
						},
					],
				},
			],
		};

		const result = generateSimpleCourseStructureTree(
			courseStructure,
			"JavaScript Basics",
		);

		expect(result).toContain("JavaScript Basics");
		expect(result).toContain("Introduction");
		expect(result).toContain("Activity Module 201");
		expect(result).toContain("Chapter 1");
		expect(result).toContain("Activity Module 202");

		// Should not contain order information
		expect(result).not.toContain("order:");
		expect(result).not.toContain("contentOrder:");
	});

	test("should handle empty course structure", () => {
		const courseStructure: CourseStructure = {
			courseId: 1,
			sections: [],
		};

		const result = generateCourseStructureTree(courseStructure);

		expect(result).toBe("Course 1");
	});

	test("should handle sections with no content", () => {
		const courseStructure: CourseStructure = {
			courseId: 1,
			sections: [
				{
					id: 1,
					title: "Empty Section",
					description: "Section with no content",
					contentOrder: 0,
					type: "section",
					content: [],
				},
			],
		};

		const result = generateCourseStructureTree(courseStructure);

		expect(result).toContain("Course 1");
		expect(result).toContain("Empty Section (contentOrder: 0)");
		expect(result.split("\n")).toHaveLength(2); // Only course title and section
	});

	test("should handle deeply nested structure", () => {
		const courseStructure: CourseStructure = {
			courseId: 1,
			sections: [
				{
					id: 1,
					title: "Level 1",
					description: "First level",
					contentOrder: 0,
					type: "section",
					content: [
						{
							id: 2,
							title: "Level 2",
							description: "Second level",
							contentOrder: 1,
							type: "section",
							content: [
								{
									id: 3,
									title: "Level 3",
									description: "Third level",
									contentOrder: 1,
									type: "section",
									content: [
										{
											id: 301,
											type: "activity-module",
											contentOrder: 1,
											module: {
												id: 301,
												title: "Activity Module 301",
												type: "quiz",
											},
										},
									],
								},
							],
						},
					],
				},
			],
		};

		const result = generateCourseStructureTree(courseStructure);

		expect(result).toContain("Level 1");
		expect(result).toContain("Level 2");
		expect(result).toContain("Level 3");
		expect(result).toContain("Activity Module 301");

		// Verify proper indentation for deep nesting
		const lines = result.split("\n");
		const level1Index = lines.findIndex((line) => line.includes("Level 1"));
		const level2Index = lines.findIndex((line) => line.includes("Level 2"));
		const level3Index = lines.findIndex((line) => line.includes("Level 3"));
		const moduleIndex = lines.findIndex((line) =>
			line.includes("Activity Module 301"),
		);

		expect(level2Index).toBeGreaterThan(level1Index);
		expect(level3Index).toBeGreaterThan(level2Index);
		expect(moduleIndex).toBeGreaterThan(level3Index);
	});

	test("should handle mixed content order correctly", () => {
		const courseStructure: CourseStructure = {
			courseId: 1,
			sections: [
				{
					id: 1,
					title: "Mixed Content Section",
					description: "Section with mixed content order",
					contentOrder: 0,
					type: "section",
					content: [
						{
							id: 401,
							type: "activity-module",
							contentOrder: 1,
							module: {
								id: 401,
								title: "Activity Module 401",
								type: "page",
							},
						},
						{
							id: 2,
							title: "Subsection",
							description: "A subsection",
							contentOrder: 2,
							type: "section",
							content: [
								{
									id: 402,
									type: "activity-module",
									contentOrder: 1,
									module: {
										id: 402,
										title: "Activity Module 402",
										type: "assignment",
									},
								},
							],
						},
						{
							id: 403,
							type: "activity-module",
							contentOrder: 3,
							module: {
								id: 403,
								title: "Activity Module 403",
								type: "discussion",
							},
						},
					],
				},
			],
		};

		const result = generateCourseStructureTree(courseStructure);

		// Verify the order of content items
		const lines = result.split("\n");
		const module401Index = lines.findIndex((line) =>
			line.includes("Activity Module 401"),
		);
		const subsectionIndex = lines.findIndex((line) =>
			line.includes("Subsection"),
		);
		const module403Index = lines.findIndex((line) =>
			line.includes("Activity Module 403"),
		);

		expect(module401Index).toBeLessThan(subsectionIndex);
		expect(subsectionIndex).toBeLessThan(module403Index);
	});
});
