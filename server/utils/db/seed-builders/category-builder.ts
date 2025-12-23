import { tryCreateCategory } from "../../../internal/course-category-management";
import { seedLogger } from "../seed-utils/logger";
import type { SeedContext } from "./user-builder";

export interface CreatedCategory {
	name: string;
	id: number;
}

/**
 * Creates all course categories for seeding
 */
export async function buildCategories(
	ctx: SeedContext,
): Promise<CreatedCategory[]> {
	seedLogger.section("Creating Course Categories");

	const categories: CreatedCategory[] = [];

	const stem = await tryCreateCategory({
		payload: ctx.payload,
		req: ctx.req,
		name: "STEM",
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "STEM", id: stem.id });
	seedLogger.success(`Category created: STEM (ID: ${stem.id})`);

	const humanities = await tryCreateCategory({
		payload: ctx.payload,
		req: ctx.req,
		name: "Humanities",
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "Humanities", id: humanities.id });
	seedLogger.success(`Category created: Humanities (ID: ${humanities.id})`);

	const cs = await tryCreateCategory({
		payload: ctx.payload,
		req: ctx.req,
		name: "Computer Science",
		parent: stem.id,
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "Computer Science", id: cs.id });
	seedLogger.success(`Category created: Computer Science (ID: ${cs.id})`);

	const math = await tryCreateCategory({
		payload: ctx.payload,
		req: ctx.req,
		name: "Mathematics",
		parent: stem.id,
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "Mathematics", id: math.id });
	seedLogger.success(`Category created: Mathematics (ID: ${math.id})`);

	return categories;
}
