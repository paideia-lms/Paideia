import type { SeedData } from "../seed-schema";
import {
	tryCreateUser,
	tryRegisterFirstUser,
	tryUpdateUser,
} from "../../../internal/user-management";
import { createFileFromVfs } from "../seed-utils/vfs-utils";
import { seedLogger } from "../seed-utils/logger";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";

export interface SeedContext {
	payload: BaseInternalFunctionArgs["payload"];
	req: BaseInternalFunctionArgs["req"];
}

type RegisterFirstUserResult = Awaited<
	ReturnType<typeof tryRegisterFirstUser>
>["value"];

export interface CreatedUsers {
	admin: NonNullable<RegisterFirstUserResult>["user"];
	student: NonNullable<Awaited<ReturnType<typeof tryCreateUser>>["value"]>;
	teacher: NonNullable<Awaited<ReturnType<typeof tryCreateUser>>["value"]>;
	ta: NonNullable<Awaited<ReturnType<typeof tryCreateUser>>["value"]>;
	additional: NonNullable<Awaited<ReturnType<typeof tryCreateUser>>["value"]>[];
}

/**
 * Creates admin user (first user)
 */
async function createAdminUser(
	ctx: SeedContext,
	adminData: SeedData["admin"],
): Promise<CreatedUsers["admin"]> {
	seedLogger.info("👤 Creating admin user...");

	const adminResult = await tryRegisterFirstUser({
		payload: ctx.payload,
		req: ctx.req,
		email: adminData.email,
		password: adminData.password,
		firstName: adminData.firstName,
		lastName: adminData.lastName,
	}).getOrThrow();

	if (!adminResult) {
		throw new Error("Failed to create admin user");
	}

	const adminUser = adminResult.user;

	// Assign admin avatar
	const avatarFile = await createFileFromVfs(
		"fixture/paideia-logo.png",
		"paideia-logo.png",
	);
	if (avatarFile) {
		const updateResult = await tryUpdateUser({
			payload: ctx.payload,
			userId: adminUser.id,
			data: { avatar: avatarFile },
			req: ctx.req,
			overrideAccess: true,
		}).getOrThrow();

		seedLogger.success(
			`Admin avatar assigned with media ID: ${updateResult.avatar}`,
		);
	}

	seedLogger.success(`Admin user created with ID: ${adminUser.id}`);
	return adminUser;
}

/**
 * Creates a regular user with optional avatar
 */
async function createUser(
	ctx: SeedContext,
	userData: {
		email: string;
		password: string;
		firstName: string;
		lastName: string;
		role: "student" | "admin";
	},
	avatarPath: string | null,
	avatarFilename: string | null,
): Promise<Awaited<ReturnType<typeof tryCreateUser>>["value"]> {
	const avatarFile =
		avatarPath && avatarFilename
			? await createFileFromVfs(avatarPath, avatarFilename)
			: null;

	const user = await tryCreateUser({
		payload: ctx.payload,
		data: {
			email: userData.email,
			password: userData.password,
			firstName: userData.firstName,
			lastName: userData.lastName,
			role: userData.role,
			avatar: avatarFile || undefined,
		},
		req: ctx.req,
		overrideAccess: true,
	}).getOrThrow();

	return user;
}

/**
 * Creates all users for seeding
 */
export async function buildUsers(
	ctx: SeedContext,
	data: SeedData,
): Promise<CreatedUsers> {
	seedLogger.section("Creating Users");

	const admin = await createAdminUser(ctx, data.admin);

	seedLogger.info("👤 Creating student user...");
	const student = await createUser(
		ctx,
		{ ...data.users.student, role: "student" },
		"fixture/gem.png",
		"gem.png",
	);
	if (!student) {
		throw new Error("Failed to create student user");
	}
	seedLogger.success(`Student user created with ID: ${student.id}`);

	seedLogger.info("👤 Creating teacher user...");
	const teacher = await createUser(
		ctx,
		{ ...data.users.teacher, role: "student" },
		null,
		null,
	);
	if (!teacher) {
		throw new Error("Failed to create teacher user");
	}
	seedLogger.success(`Teacher user created with ID: ${teacher.id}`);

	seedLogger.info("👤 Creating TA user...");
	const ta = await createUser(
		ctx,
		{ ...data.users.ta, role: "student" },
		null,
		null,
	);
	if (!ta) {
		throw new Error("Failed to create TA user");
	}
	seedLogger.success(`TA user created with ID: ${ta.id}`);

	seedLogger.info("👤 Creating additional students...");
	const additional: CreatedUsers["additional"] = [];
	for (const studentData of data.users.additionalStudents) {
		const user = await createUser(
			ctx,
			{ ...studentData, role: "student" },
			null,
			null,
		);
		if (user) {
			additional.push(user);
			seedLogger.success(`Additional student created with ID: ${user.id}`);
		}
	}

	return { admin, student, teacher, ta, additional };
}
