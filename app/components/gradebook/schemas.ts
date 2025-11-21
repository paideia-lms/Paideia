import { z } from "zod";

export const createItemSchema = z.object({
	intent: z.literal("create-item"),
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	categoryId: z.coerce.number().optional().nullable(),
	maxGrade: z.coerce.number().optional(),
	minGrade: z.coerce.number().optional(),
	weight: z.coerce.number().nullable(),
	extraCredit: z.boolean().optional(),
});

export const createCategorySchema = z.object({
	intent: z.literal("create-category"),
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	parentId: z.coerce.number().optional().nullable(),
	extraCredit: z.boolean().optional(),
});

export const updateItemSchema = z.object({
	intent: z.literal("update-item"),
	itemId: z.coerce.number(),
	name: z.string().min(1, "Name is required").optional(),
	description: z.string().optional(),
	categoryId: z.coerce.number().optional().nullable(),
	maxGrade: z.coerce.number().optional(),
	minGrade: z.coerce.number().optional(),
	weight: z.coerce.number().nullable(),
	extraCredit: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
	intent: z.literal("update-category"),
	categoryId: z.coerce.number(),
	name: z.string().min(1, "Name is required").optional(),
	description: z.string().optional(),
	weight: z.coerce.number().nullable(),
	extraCredit: z.boolean().optional(),
});

export const getItemSchema = z.object({
	intent: z.literal("get-item"),
	itemId: z.coerce.number(),
});

export const getCategorySchema = z.object({
	intent: z.literal("get-category"),
	categoryId: z.coerce.number(),
});

export const deleteItemSchema = z.object({
	intent: z.literal("delete-item"),
	itemId: z.coerce.number(),
});

export const deleteCategorySchema = z.object({
	intent: z.literal("delete-category"),
	categoryId: z.coerce.number(),
});

export const inputSchema = z.discriminatedUnion("intent", [
	createItemSchema,
	createCategorySchema,
	updateItemSchema,
	updateCategorySchema,
	getItemSchema,
	getCategorySchema,
	deleteItemSchema,
	deleteCategorySchema,
]);
