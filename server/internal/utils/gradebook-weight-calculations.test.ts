import { describe, expect, it } from "bun:test";
import type {
    GradebookSetupItem,
    GradebookSetupItemWithCalculations,
} from "../gradebook-management";
import {
    calculateAdjustedWeights,
    calculateOverallWeights,
} from "./gradebook-weight-calculations";

describe("Gradebook Weight Calculations", () => {
    describe("calculateAdjustedWeights", () => {
        it("should calculate adjusted weights for items with specified weights", () => {
            const items: GradebookSetupItem[] = [
                {
                    id: 1,
                    type: "manual_item",
                    name: "Item 1",
                    weight: 40,
                    max_grade: 100,
                },
                {
                    id: 2,
                    type: "manual_item",
                    name: "Item 2",
                    weight: 60,
                    max_grade: 100,
                },
            ];

            const result = calculateAdjustedWeights(items);

            expect(result.length).toBe(2);
            expect(
                (result[0] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(40);
            expect(
                (result[1] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(60);
        });

        it("should calculate adjusted weights for items without weights", () => {
            const items: GradebookSetupItem[] = [
                {
                    id: 1,
                    type: "manual_item",
                    name: "Item 1",
                    weight: null,
                    max_grade: 100,
                },
                {
                    id: 2,
                    type: "manual_item",
                    name: "Item 2",
                    weight: null,
                    max_grade: 100,
                },
            ];

            const result = calculateAdjustedWeights(items);

            expect(result.length).toBe(2);
            // Each item should get 50% (100% / 2)
            expect(
                (result[0] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(50);
            expect(
                (result[1] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(50);
        });

        it("should calculate adjusted weights for mixed items", () => {
            const items: GradebookSetupItem[] = [
                {
                    id: 1,
                    type: "manual_item",
                    name: "Item 1",
                    weight: 40,
                    max_grade: 100,
                },
                {
                    id: 2,
                    type: "manual_item",
                    name: "Item 2",
                    weight: null,
                    max_grade: 100,
                },
                {
                    id: 3,
                    type: "manual_item",
                    name: "Item 3",
                    weight: null,
                    max_grade: 100,
                },
            ];

            const result = calculateAdjustedWeights(items);

            expect(result.length).toBe(3);
            expect(
                (result[0] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(40);
            // Remaining 60% divided by 2 = 30% each
            expect(
                (result[1] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(30);
            expect(
                (result[2] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(30);
        });

        it("should calculate adjusted weights for nested categories", () => {
            const items: GradebookSetupItem[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 50,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "manual_item",
                            name: "Item 1",
                            weight: 60,
                            max_grade: 100,
                        },
                        {
                            id: 3,
                            type: "manual_item",
                            name: "Item 2",
                            weight: null,
                            max_grade: 100,
                        },
                    ],
                },
            ];

            const result = calculateAdjustedWeights(items);

            expect(result.length).toBe(1);
            expect(
                (result[0] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(50);
            expect(result[0].grade_items).toBeDefined();
            if (result[0].grade_items) {
                expect(
                    (result[0].grade_items[0] as GradebookSetupItemWithCalculations)
                        .adjusted_weight,
                ).toBe(60);
                // Remaining 40% goes to Item 2
                expect(
                    (result[0].grade_items[1] as GradebookSetupItemWithCalculations)
                        .adjusted_weight,
                ).toBe(40);
            }
        });

        it("should exclude extra credit items from weight distribution", () => {
            const items: GradebookSetupItem[] = [
                {
                    id: 1,
                    type: "manual_item",
                    name: "Item 1",
                    weight: 40,
                    max_grade: 100,
                },
                {
                    id: 2,
                    type: "manual_item",
                    name: "Item 2",
                    weight: 60,
                    max_grade: 100,
                },
                {
                    id: 3,
                    type: "manual_item",
                    name: "Extra Credit Item",
                    weight: 5,
                    max_grade: 100,
                    extra_credit: true,
                },
            ];

            const result = calculateAdjustedWeights(items);

            expect(result.length).toBe(3);
            // Non-extra-credit items should keep their weights
            expect(
                (result[0] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(40);
            expect(
                (result[1] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(60);
            // Extra credit item should use its specified weight
            expect(
                (result[2] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(5);
            expect(
                (result[2] as GradebookSetupItemWithCalculations).extra_credit,
            ).toBe(true);
        });

        it("should distribute remaining weight only among non-extra-credit items", () => {
            const items: GradebookSetupItem[] = [
                {
                    id: 1,
                    type: "manual_item",
                    name: "Item 1",
                    weight: 40,
                    max_grade: 100,
                },
                {
                    id: 2,
                    type: "manual_item",
                    name: "Item 2",
                    weight: null,
                    max_grade: 100,
                },
                {
                    id: 3,
                    type: "manual_item",
                    name: "Extra Credit Item",
                    weight: 10,
                    max_grade: 100,
                    extra_credit: true,
                },
            ];

            const result = calculateAdjustedWeights(items);

            expect(result.length).toBe(3);
            // Item 1: 40%
            expect(
                (result[0] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(40);
            // Item 2: Remaining 60% (not affected by extra credit)
            expect(
                (result[1] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(60);
            // Extra credit: Uses its specified weight, doesn't affect distribution
            expect(
                (result[2] as GradebookSetupItemWithCalculations).adjusted_weight,
            ).toBe(10);
        });
    });

    describe("calculateOverallWeights", () => {
        it("should calculate overall weights for root-level items", () => {
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "manual_item",
                    name: "Item 1",
                    weight: 40,
                    adjusted_weight: 40,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: 100,
                },
            ];

            const totals = calculateOverallWeights(items);

            // Root-level item's overall weight equals its adjusted weight
            expect(items[0].overall_weight).toBe(40);
            // Root-level item should have explanation showing just the item
            expect(items[0].weight_explanation).toBe("Item 1 (40.00%) = 40.00%");

            // Totals should be correct
            expect(totals.baseTotal).toBe(40);
            expect(totals.extraCreditTotal).toBe(0);
            expect(totals.calculatedTotal).toBe(100);
        });

        it("should calculate overall weights for items in categories", () => {
            // The function processes recursively, so we need to understand the context
            // When processing items within a category, it searches in the parent scope
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "manual_item",
                            name: "Item 1",
                            weight: 40,
                            adjusted_weight: 40,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                        {
                            id: 3,
                            type: "manual_item",
                            name: "Item 2",
                            weight: 60,
                            adjusted_weight: 60,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
            ];

            const totals = calculateOverallWeights(items);

            // Note: The function is processing recursively, so when it processes items
            // within category 1, it searches for the parent in the root `items` array.
            // Since item 2 is inside category 1 (which is in the root array), it should find it.

            // Category should not have overall weight (categories don't get overall weight)
            // However, categories might get overall_weight set if they're processed as leaf items
            // The function checks `if (item.type === "category")` but continues processing
            // Let's check what actually happens
            if (items[0].grade_items) {
                // Items inside the category should have their overall weight calculated
                const item1 = items[0].grade_items[0] as GradebookSetupItemWithCalculations;
                const item2 = items[0].grade_items[1] as GradebookSetupItemWithCalculations;

                // Since these items are processed within the recursive call,
                // and the function searches in the parent scope (items),
                // it should find category 1 as the parent
                // Item 1: 50% (category) * 40% (item) = 20%
                expect(item1.overall_weight).toBe(20);
                expect(item1.weight_explanation).toBe(
                    "Category 1 (50.00%) × Item 1 (40.00%) = 20.00%",
                );
                // Item 2: 50% (category) * 60% (item) = 30%
                expect(item2.overall_weight).toBe(30);
                expect(item2.weight_explanation).toBe(
                    "Category 1 (50.00%) × Item 2 (60.00%) = 30.00%",
                );
            }
        });

        it("should calculate overall weights for nested categories", () => {
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 35,
                    adjusted_weight: 35,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "category",
                            name: "Category 2",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: null,
                            grade_items: [
                                {
                                    id: 3,
                                    type: "manual_item",
                                    name: "Item 1",
                                    weight: 10,
                                    adjusted_weight: 10,
                                    overall_weight: null,
                                    weight_explanation: null,
                                    max_grade: 100,
                                },
                            ] as GradebookSetupItemWithCalculations[],
                        } as GradebookSetupItemWithCalculations,
                    ] as GradebookSetupItemWithCalculations[],
                },
            ];

            const totals = calculateOverallWeights(items);

            // Item 1: 35% (parent category) * 50% (nested category) * 10% (item) = 1.75%
            const item = items[0].grade_items?.[0]
                .grade_items?.[0] as GradebookSetupItemWithCalculations | undefined;
            if (item) {
                expect(item.overall_weight).toBeCloseTo(1.75, 2);
                expect(item.weight_explanation).toBe(
                    "Category 1 (35.00%) × Category 2 (50.00%) × Item 1 (10.00%) = 1.75%",
                );
            }

            // Verify totals
            expect(totals.baseTotal).toBeCloseTo(1.75, 2);
            expect(totals.extraCreditTotal).toBe(0);
            expect(totals.calculatedTotal).toBe(100);
        });

        it("should set overall weight to null for items without adjusted weight", () => {
            const items = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "manual_item",
                            name: "Item 1",
                            weight: null,
                            adjusted_weight: null,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ],
                },
            ];

            const totals = calculateOverallWeights(items as GradebookSetupItemWithCalculations[]);

            // Item without adjusted weight should have null overall weight
            if (items[0].grade_items) {
                const item = items[0].grade_items[0] as GradebookSetupItemWithCalculations;
                expect(item.overall_weight).toBeNull();
                expect(item.weight_explanation).toBeNull();
            }

            // Totals should reflect null weight item
            expect(totals.baseTotal).toBe(0);
            expect(totals.extraCreditTotal).toBe(0);
            expect(totals.calculatedTotal).toBe(100);
        });

        it("should not calculate overall weight for categories", () => {
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                },
            ];

            const totals = calculateOverallWeights(items);

            // Categories should not have overall weight or explanation
            expect(items[0].overall_weight).toBeNull();
            expect(items[0].weight_explanation).toBeNull();

            // Totals should be correct for categories
            expect(totals.baseTotal).toBe(0);
            expect(totals.extraCreditTotal).toBe(0);
            expect(totals.calculatedTotal).toBe(100);
        });

        it("should calculate total overall weight correctly without extra credit", () => {
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "manual_item",
                            name: "Item 1",
                            weight: 40,
                            adjusted_weight: 40,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                        {
                            id: 3,
                            type: "manual_item",
                            name: "Item 2",
                            weight: 60,
                            adjusted_weight: 60,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
                {
                    id: 4,
                    type: "manual_item",
                    name: "Root Item",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: 100,
                },
            ];

            const totals = calculateOverallWeights(items);

            // Item 1: 50% * 40% = 20%
            // Item 2: 50% * 60% = 30%
            // Root Item: 50%
            // Base total: 20% + 30% + 50% = 100%
            expect(totals.baseTotal).toBeCloseTo(100, 2);
            expect(totals.extraCreditTotal).toBe(0);
            expect(totals.calculatedTotal).toBe(100);
        });

        it("should calculate total overall weight correctly with extra credit", () => {
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "manual_item",
                            name: "Item 1",
                            weight: 40,
                            adjusted_weight: 40,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                        {
                            id: 3,
                            type: "manual_item",
                            name: "Item 2",
                            weight: 60,
                            adjusted_weight: 60,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
                {
                    id: 4,
                    type: "manual_item",
                    name: "Root Item",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: 100,
                },
                {
                    id: 5,
                    type: "manual_item",
                    name: "Extra Credit Item",
                    weight: 5,
                    adjusted_weight: 5,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: 100,
                    extra_credit: true,
                },
            ];

            const totals = calculateOverallWeights(items);

            // Item 1: 50% * 40% = 20%
            // Item 2: 50% * 60% = 30%
            // Root Item: 50%
            // Extra Credit Item: 5% (doesn't affect the 100% base)
            // Base total: 20% + 30% + 50% = 100%
            // Extra credit total: 5%
            // Calculated total: 100% + 5% = 105%
            expect(totals.baseTotal).toBeCloseTo(100, 2);
            expect(totals.extraCreditTotal).toBe(5);
            expect(totals.calculatedTotal).toBe(105);

            // Verify extra credit item is identified
            expect(totals.extraCreditItems.length).toBe(1);
            expect(totals.extraCreditItems[0].overall_weight).toBe(5);
        });

        it("should reproduce 101.05% scenario and verify calculation", () => {
            // This test reproduces a scenario that might result in 101.05%
            // Common causes: floating point precision, or extra credit not being properly excluded
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 33.33,
                    adjusted_weight: 33.33,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "manual_item",
                            name: "Item 1",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                        {
                            id: 3,
                            type: "manual_item",
                            name: "Item 2",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
                {
                    id: 4,
                    type: "category",
                    name: "Category 2",
                    weight: 33.33,
                    adjusted_weight: 33.33,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 5,
                            type: "manual_item",
                            name: "Item 3",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                        {
                            id: 6,
                            type: "manual_item",
                            name: "Item 4",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
                {
                    id: 7,
                    type: "category",
                    name: "Category 3",
                    weight: 33.34,
                    adjusted_weight: 33.34,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 8,
                            type: "manual_item",
                            name: "Item 5",
                            weight: 100,
                            adjusted_weight: 100,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
            ];

            const totals = calculateOverallWeights(items);

            // Item 1: 33.33% * 50% = 16.665%
            // Item 2: 33.33% * 50% = 16.665%
            // Item 3: 33.33% * 50% = 16.665%
            // Item 4: 33.33% * 50% = 16.665%
            // Item 5: 33.34% * 100% = 33.34%
            // Base total: 16.665 + 16.665 + 16.665 + 16.665 + 33.34 = 100%
            expect(totals.baseTotal).toBeCloseTo(100, 2);
            expect(totals.extraCreditTotal).toBe(0);
            expect(totals.calculatedTotal).toBe(100);

            // Verify no extra credit items
            expect(totals.extraCreditItems.length).toBe(0);
        });

        it("should reproduce exact 101.05% scenario with extra credit", () => {
            // Test case that results in exactly 101.05%
            // This could happen if: regular items total 100% + extra credit adds 1.05%
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "manual_item",
                    name: "Item 1",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: 100,
                },
                {
                    id: 2,
                    type: "manual_item",
                    name: "Item 2",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: 100,
                },
                {
                    id: 3,
                    type: "manual_item",
                    name: "Extra Credit Item",
                    weight: 1.05,
                    adjusted_weight: 1.05,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: 100,
                    extra_credit: true,
                },
            ];

            const totals = calculateOverallWeights(items);

            // Item 1: 50%
            // Item 2: 50%
            // Extra Credit Item: 1.05%
            // Base total: 50% + 50% = 100%
            // Extra credit total: 1.05%
            // Calculated total: 100% + 1.05% = 101.05%
            expect(totals.baseTotal).toBeCloseTo(100, 2);
            expect(totals.extraCreditTotal).toBeCloseTo(1.05, 2);
            expect(totals.calculatedTotal).toBeCloseTo(101.05, 2);

            // Verify extra credit item is identified
            expect(totals.extraCreditItems.length).toBe(1);
            expect(totals.extraCreditItems[0].overall_weight).toBeCloseTo(1.05, 2);
        });

        it("should reproduce 113.8% scenario with extra credit items in categories", () => {
            // This test reproduces the exact scenario the user reported:
            // - Base items total: 100%
            // - Extra credit items: 12.00% + 1.80% = 13.80%
            // - Total should be: 113.80%
            // But currently showing: 101.05%
            // 
            // This suggests that extra credit items in categories might not be
            // getting their overall_weight calculated correctly, or base items aren't summing to 100%
            const items: GradebookSetupItemWithCalculations[] = [
                {
                    id: 1,
                    type: "category",
                    name: "Category 1",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 2,
                            type: "manual_item",
                            name: "Item 1",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                        {
                            id: 3,
                            type: "manual_item",
                            name: "Item 2",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
                {
                    id: 4,
                    type: "category",
                    name: "Category 2",
                    weight: 50,
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 5,
                            type: "manual_item",
                            name: "Item 3",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                        {
                            id: 6,
                            type: "manual_item",
                            name: "Item 4",
                            weight: 50,
                            adjusted_weight: 50,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
                {
                    id: 7,
                    type: "category",
                    name: "Category 3",
                    weight: 50, // Category with extra credit items - weight needed for correct calculation
                    adjusted_weight: 50,
                    overall_weight: null,
                    weight_explanation: null,
                    max_grade: null,
                    grade_items: [
                        {
                            id: 8,
                            type: "manual_item",
                            name: "extra credit",
                            weight: 24, // This should result in 12% overall: 50% * 24% = 12%
                            adjusted_weight: 24,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                            extra_credit: true,
                        },
                        {
                            id: 9,
                            type: "manual_item",
                            name: "extra credit 2",
                            weight: 3.6, // This should result in 1.8% overall: 50% * 3.6% = 1.8%
                            adjusted_weight: 3.6,
                            overall_weight: null,
                            weight_explanation: null,
                            max_grade: 100,
                            extra_credit: true,
                        },
                    ] as GradebookSetupItemWithCalculations[],
                },
            ];

            calculateOverallWeights(items);

            // Calculate total overall weight from all leaf items
            const collectLeafItems = (
                items: GradebookSetupItemWithCalculations[],
            ): GradebookSetupItemWithCalculations[] => {
                const leafItems: GradebookSetupItemWithCalculations[] = [];
                for (const item of items) {
                    if (item.type === "category" && item.grade_items) {
                        leafItems.push(...collectLeafItems(item.grade_items));
                    } else {
                        leafItems.push(item);
                    }
                }
                return leafItems;
            };

            const allLeafItems = collectLeafItems(items);

            // Separate base and extra credit items
            const baseItems = allLeafItems.filter(
                (item) => !(item.extra_credit === true),
            );
            const extraCreditItems = allLeafItems.filter(
                (item) => item.extra_credit === true && item.overall_weight !== null,
            );

            const baseTotal = baseItems.reduce(
                (sum, item) => sum + (item.overall_weight ?? 0),
                0,
            );
            const extraCreditTotal = extraCreditItems.reduce(
                (sum, item) => sum + (item.overall_weight ?? 0),
                0,
            );
            const totalOverallWeight = 100 + extraCreditTotal;

            console.log("baseTotal", baseTotal);
            console.log("extraCreditTotal", extraCreditTotal);
            console.log("totalOverallWeight", totalOverallWeight);
            console.log("baseItems", baseItems);
            console.log("extraCreditItems", extraCreditItems);

            // Base items should total 100%
            // Item 1: 50% * 50% = 25%
            // Item 2: 50% * 50% = 25%
            // Item 3: 50% * 50% = 25%
            // Item 4: 50% * 50% = 25%
            // Base total: 100%
            expect(baseTotal).toBe(100);

            // Extra credit items in Category 3 (weight: 50%)
            // extra credit: 50% * 24% = 12%
            // extra credit 2: 50% * 3.6% = 1.8%
            // Extra credit total: 12% + 1.8% = 13.8%
            expect(extraCreditTotal).toBeCloseTo(13.8, 2);
            expect(extraCreditItems[0].overall_weight).toBeCloseTo(12, 2);
            expect(extraCreditItems[1].overall_weight).toBeCloseTo(1.8, 2);

            // Total should be: 100% + 13.8% = 113.8%
            expect(totalOverallWeight).toBeCloseTo(113.8, 2);
            expect(extraCreditItems.length).toBe(2);
        });
    });
});

