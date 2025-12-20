import { SeedDataLoadError, transformError } from "app/utils/error";
import type { Simplify } from "drizzle-orm/utils";
import type { Payload } from "payload";
import type { LatestQuizConfig } from "server/json";
import { Result } from "typescript-result";
import {
	type ActivityModuleResult,
	tryCreateAssignmentModule,
	tryCreateDiscussionModule,
	tryCreatePageModule,
	tryCreateQuizModule,
	tryCreateWhiteboardModule,
} from "../../internal/activity-module-management";
import { tryCreateCourseActivityModuleLink } from "../../internal/course-activity-module-link-management";
import { tryCreateCategory } from "../../internal/course-category-management";
import { tryCreateCourse } from "../../internal/course-management";
import { tryCreateSection } from "../../internal/course-section-management";
import { tryCreateEnrollment } from "../../internal/enrollment-management";
import { tryCreateMedia } from "../../internal/media-management";
import {
	tryCreateUser,
	tryRegisterFirstUser,
	tryUpdateUser,
	tryGetUserCount,
} from "../../internal/user-management";
import vfs from "../../vfs";
import { testData } from "./predefined-seed-data";
import type { SeedData } from "./seed-schema";

type DeepReadonly<T> = Simplify<{
	readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
}>;

export interface RunSeedArgs {
	payload: Payload;
	seedData?: SeedData | DeepReadonly<SeedData>;
}

/**
 * Get file content from VFS as Buffer
 * Falls back to file system in development mode if VFS is empty
 */
async function getVfsFileBuffer(
	vfs: Record<string, string>,
	path: string,
): Promise<Buffer | null> {
	const base64Content = vfs[path];
	if (base64Content) {
		return Buffer.from(base64Content, "base64");
	}

	// Fallback to file system in development mode if VFS is empty
	if (process.env.NODE_ENV === "development") {
		try {
			const file = Bun.file(path);
			if (await file.exists()) {
				const buffer = await file.arrayBuffer();
				return Buffer.from(buffer);
			}
		} catch {
			// Ignore errors, return null
		}
	}

	return null;
}

/**
 * Get file content from VFS as text
 */
async function getVfsFileText(
	vfs: Record<string, string>,
	path: string,
): Promise<string | null> {
	const buffer = await getVfsFileBuffer(vfs, path);
	if (!buffer) return null;
	return buffer.toString("utf-8");
}

/**
 * Create user with avatar from VFS
 */
async function createUserWithAvatar(
	payload: Payload,
	req: Request,
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
	const user = await tryCreateUser({
		payload,
		data: {
			email: userData.email,
			password: userData.password,
			firstName: userData.firstName,
			lastName: userData.lastName,
			role: userData.role,
		},
		req,
		overrideAccess: true,
	}).getOrThrow();

	if (avatarPath && avatarFilename) {
		const avatarBuffer = await getVfsFileBuffer(vfs, avatarPath);
		if (avatarBuffer) {
			const avatarFile = new File(
				[new Uint8Array(avatarBuffer)],
				avatarFilename,
				{
					type: "image/png",
				},
			);

			await tryUpdateUser({
				payload,
				userId: user.id,
				data: { avatar: avatarFile },
				overrideAccess: true,
			}).getOrThrow();
		}
	}

	return user;
}

/**
 * Create admin user (first user)
 */
async function createAdminUser(
	payload: Payload,
	req: Request,
	adminData: SeedData["admin"],
): Promise<
	NonNullable<Awaited<ReturnType<typeof tryRegisterFirstUser>>["value"]>["user"]
> {
	const adminUser = (
		await tryRegisterFirstUser({
			payload,
			req,
			email: adminData.email,
			password: adminData.password,
			firstName: adminData.firstName,
			lastName: adminData.lastName,
		}).getOrThrow()
	).user;

	// Create and assign admin avatar
	const avatarBuffer = await getVfsFileBuffer(vfs, "fixture/paideia-logo.png");
	if (avatarBuffer) {
		const avatarFile = new File(
			[new Uint8Array(avatarBuffer)],
			"paideia-logo.png",
			{
				type: "image/png",
			},
		);

		const updateResult = await tryUpdateUser({
			payload,
			userId: adminUser.id,
			data: { avatar: avatarFile },
			overrideAccess: true,
		});

		if (updateResult.ok) {
			console.log(
				`✅ Admin avatar assigned with media ID: ${updateResult.value.avatar}`,
			);
		}
	}

	return adminUser;
}

/**
 * Create course categories
 */
async function createCategories(
	payload: Payload,
	req: Request,
): Promise<{ name: string; id: number }[]> {
	const categories: { name: string; id: number }[] = [];

	const stem = await tryCreateCategory({
		payload,
		req,
		name: "STEM",
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "STEM", id: stem.id });

	const humanities = await tryCreateCategory({
		payload,
		req,
		name: "Humanities",
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "Humanities", id: humanities.id });

	const cs = await tryCreateCategory({
		payload,
		req,
		name: "Computer Science",
		parent: stem.id,
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "Computer Science", id: cs.id });

	const math = await tryCreateCategory({
		payload,
		req,
		name: "Mathematics",
		parent: stem.id,
		overrideAccess: true,
	}).getOrThrow();
	categories.push({ name: "Mathematics", id: math.id });

	return categories;
}

/**
 * Create courses
 */
async function createCourses(
	payload: Payload,
	coursesData: readonly SeedData["courses"][number][],
	adminUserId: number,
	categories: { name: string; id: number }[],
): Promise<Awaited<ReturnType<typeof tryCreateCourse>>["value"][]> {
	const courses: Awaited<ReturnType<typeof tryCreateCourse>>["value"][] = [];

	// Create first 6 courses with categories
	for (let i = 0; i < 6; i++) {
		const courseData = coursesData[i]!;
		const categoryId =
			categories.length > 0 ? categories[i % categories.length]!.id : undefined;

		courses.push(
			await tryCreateCourse({
				payload,
				data: {
					title: courseData.title,
					description: courseData.description,
					slug: courseData.slug,
					createdBy: adminUserId,
					status: courseData.status,
					category: categoryId,
				},
				overrideAccess: true,
			}).getOrThrow(),
		);
	}

	// Create uncategorized course
	const uncategorizedCourseData = coursesData[6]!;
	courses.push(
		await tryCreateCourse({
			payload,
			data: {
				title: uncategorizedCourseData.title,
				description: uncategorizedCourseData.description,
				slug: uncategorizedCourseData.slug,
				createdBy: adminUserId,
				status: uncategorizedCourseData.status,
			},
			overrideAccess: true,
		}).getOrThrow(),
	);

	return courses;
}

/**
 * Create enrollment
 */
async function createEnrollment(
	payload: Payload,
	req: Request,
	userId: number,
	courseId: number,
	role: "student" | "teacher" | "ta" | "manager",
	status: "active" | "inactive" | "completed",
): Promise<Awaited<ReturnType<typeof tryCreateEnrollment>>["value"]> {
	return await tryCreateEnrollment({
		payload,
		userId,
		course: courseId,
		role,
		status,
		req,
		overrideAccess: true,
	}).getOrThrow();
}

/**
 * Create whiteboard fixture loader with state tracking
 */
function createWhiteboardFixtureLoader(): () => Promise<string> {
	let loaded = false;

	return async () => {
		if (loaded) {
			return JSON.stringify({ shapes: [], bindings: [] });
		}

		loaded = true;
		const fixtureContent = await getVfsFileText(
			vfs,
			"fixture/whiteboard-data.json",
		);

		if (!fixtureContent) {
			console.log(
				"⚠️  Skipping whiteboard fixture: whiteboard-data.json not found in VFS or file system, using empty default",
			);
			return JSON.stringify({ shapes: [], bindings: [] });
		}

		try {
			const parsed = JSON.parse(fixtureContent);
			return JSON.stringify(parsed);
		} catch (error) {
			console.error("Invalid JSON in whiteboard-data.json:", error);
			return JSON.stringify({ shapes: [], bindings: [] });
		}
	};
}

/**
 * Create activity modules
 */
async function createActivityModules(
	payload: Payload,
	modulesData: {
		page: SeedData["modules"]["page"];
		additional: readonly SeedData["modules"]["additional"][number][];
	},
	adminUserId: number,
	req?: Request,
): Promise<{
	pageModule: ActivityModuleResult;
	additionalModules: ActivityModuleResult[];
}> {
	const baseArgs = {
		payload,
		userId: adminUserId,
		user: null,
		req,
		overrideAccess: true,
	};

	// Create page module
	const pageModule = await tryCreatePageModule({
		...baseArgs,
		title: modulesData.page.title,
		description: modulesData.page.description,
		status: "published",
		content: modulesData.page.content,
	}).getOrThrow();

	// Create additional modules
	const additionalModules: ActivityModuleResult[] = [];
	const whiteboardLoader = createWhiteboardFixtureLoader();

	for (const moduleData of modulesData.additional) {
		let module: ActivityModuleResult;

		switch (moduleData.type) {
			case "page": {
				module = (await tryCreatePageModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					content: moduleData.content,
				}).getOrThrow()) as ActivityModuleResult;
				break;
			}
			case "whiteboard": {
				const whiteboardContent = await whiteboardLoader();
				module = (await tryCreateWhiteboardModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					content: whiteboardContent,
				}).getOrThrow()) as ActivityModuleResult;
				break;
			}
			case "assignment": {
				module = (await tryCreateAssignmentModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					instructions: moduleData.instructions,
				}).getOrThrow()) as ActivityModuleResult;
				break;
			}
			case "quiz": {
				const quizArgs: Parameters<typeof tryCreateQuizModule>[0] = {
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					instructions: moduleData.instructions,
					points: moduleData.points,
					timeLimit: moduleData.timeLimit,
				};
				if (moduleData.rawQuizConfig) {
					quizArgs.rawQuizConfig = moduleData.rawQuizConfig as LatestQuizConfig;
				}
				module = (await tryCreateQuizModule(
					quizArgs,
				).getOrThrow()) as ActivityModuleResult;
				break;
			}
			case "discussion": {
				module = (await tryCreateDiscussionModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					instructions: moduleData.instructions,
					minReplies: moduleData.minReplies,
					threadSorting: moduleData.threadSorting,
				}).getOrThrow()) as ActivityModuleResult;
				break;
			}
			default:
				throw new Error(
					`Unknown module type: ${(moduleData as { type: string }).type}`,
				);
		}

		additionalModules.push(module);
	}

	return {
		pageModule,
		additionalModules,
	};
}

/**
 * Create course sections
 */
async function createSections(
	payload: Payload,
	sectionsData: readonly SeedData["sections"][number][],
	courseId: number,
): Promise<Awaited<ReturnType<typeof tryCreateSection>>["value"][]> {
	const sections: Awaited<ReturnType<typeof tryCreateSection>>["value"][] = [];

	for (const sectionData of sectionsData) {
		sections.push(
			await tryCreateSection({
				payload,
				data: {
					course: courseId,
					title: sectionData.title,
					description: sectionData.description,
				},
				overrideAccess: true,
			}).getOrThrow(),
		);
	}

	return sections;
}

/**
 * Link modules to course sections
 */
async function linkModulesToSections(
	payload: Payload,
	req: Request,
	courseId: number,
	modules: ActivityModuleResult[],
	sections: Awaited<ReturnType<typeof tryCreateSection>>["value"][],
): Promise<
	Awaited<ReturnType<typeof tryCreateCourseActivityModuleLink>>["value"][]
> {
	if (sections.length === 0) {
		throw new Error(
			"No sections were created, cannot link modules to sections",
		);
	}

	const links: Awaited<
		ReturnType<typeof tryCreateCourseActivityModuleLink>
	>["value"][] = [];

	for (let i = 0; i < modules.length; i++) {
		const module = modules[i];
		if (!module) continue;

		const sectionIndex = i % sections.length;
		const section = sections[sectionIndex];
		if (!section) continue;

		links.push(
			await tryCreateCourseActivityModuleLink({
				payload,
				req,
				course: courseId,
				activityModule: module.id,
				section: section.id,
				order: Math.floor(i / sections.length),
				overrideAccess: true,
			}).getOrThrow(),
		);
	}

	return links;
}

export { testData };

/**
 * Seeds the development database with initial data
 * Only runs if the database is fresh (no users exist)
 */
export const tryRunSeed = Result.wrap(
	async (args: RunSeedArgs) => {
		const { payload, seedData } = args;
		const data = seedData ?? testData;

		console.log("🌱 Checking if database needs seeding...");

		const userCount = await tryGetUserCount({
			payload,
			overrideAccess: true,
		}).getOrThrow();

		const needsSeeding = userCount === 0;

		if (!needsSeeding) {
			console.log("✅ Database already has users, skipping seed");
			return;
		}

		console.log("🌱 Database is fresh, starting seed process...");

		const mockRequest = new Request("http://localhost:3000");

		// Create users
		console.log("👤 Creating admin user...");
		const adminUser = await createAdminUser(payload, mockRequest, data.admin);
		console.log(`✅ Admin user created with ID: ${adminUser.id}`);

		console.log("👤 Creating student user...");
		const studentUser = await createUserWithAvatar(
			payload,
			mockRequest,
			{ ...data.users.student, role: "student" },
			"fixture/gem.png",
			"gem.png",
		);
		if (!studentUser) {
			throw new Error("Failed to create student user");
		}
		console.log(`✅ Student user created with ID: ${studentUser.id}`);

		console.log("👤 Creating teacher user...");
		const teacherUser = await createUserWithAvatar(
			payload,
			mockRequest,
			{ ...data.users.teacher, role: "student" },
			null,
			null,
		);
		if (!teacherUser) {
			throw new Error("Failed to create teacher user");
		}
		console.log(`✅ Teacher user created with ID: ${teacherUser.id}`);

		console.log("👤 Creating TA user...");
		const taUser = await createUserWithAvatar(
			payload,
			mockRequest,
			{ ...data.users.ta, role: "student" },
			null,
			null,
		);
		if (!taUser) {
			throw new Error("Failed to create TA user");
		}
		console.log(`✅ TA user created with ID: ${taUser.id}`);

		console.log("👤 Creating additional students...");
		const additionalStudents: Awaited<
			ReturnType<typeof tryCreateUser>
		>["value"][] = [];
		for (const studentData of data.users.additionalStudents) {
			const student = await createUserWithAvatar(
				payload,
				mockRequest,
				{ ...studentData, role: "student" },
				null,
				null,
			);
			if (student) {
				additionalStudents.push(student);
				console.log(`✅ Additional student created with ID: ${student.id}`);
			}
		}

		// Create categories
		console.log("🏷️  Creating course categories...");
		const categories = await createCategories(payload, mockRequest);
		for (const cat of categories) {
			console.log(`✅ Category created: ${cat.name} (ID: ${cat.id})`);
		}

		// Create courses
		console.log("📚 Creating courses...");
		const courses = await createCourses(
			payload,
			data.courses as readonly SeedData["courses"][number][],
			adminUser.id,
			categories,
		);
		for (const createdCourse of courses) {
			if (createdCourse) {
				console.log(`✅ Course created with ID: ${createdCourse.id}`);
			}
		}

		if (courses.length === 0) {
			throw new Error(
				"No courses were created, cannot proceed with enrollments",
			);
		}

		const course = courses[0];
		if (!course) {
			throw new Error("First course is undefined");
		}

		// Create enrollments
		console.log("🎓 Enrolling users in course...");
		const studentEnrollment = await createEnrollment(
			payload,
			mockRequest,
			studentUser.id,
			course.id,
			"student",
			"active",
		);
		if (!studentEnrollment) {
			throw new Error("Failed to create student enrollment");
		}
		console.log(
			`✅ Student enrollment created with ID: ${studentEnrollment.id}`,
		);

		const teacherEnrollment = await createEnrollment(
			payload,
			mockRequest,
			teacherUser.id,
			course.id,
			"teacher",
			"active",
		);
		if (!teacherEnrollment) {
			throw new Error("Failed to create teacher enrollment");
		}
		console.log(
			`✅ Teacher enrollment created with ID: ${teacherEnrollment.id}`,
		);

		const taEnrollment = await createEnrollment(
			payload,
			mockRequest,
			taUser.id,
			course.id,
			"ta",
			"active",
		);
		if (!taEnrollment) {
			throw new Error("Failed to create TA enrollment");
		}
		console.log(`✅ TA enrollment created with ID: ${taEnrollment.id}`);

		if (courses.length > 1) {
			const secondCourse = courses[1];
			if (secondCourse) {
				console.log("🧑‍💼 Enrolling admin as manager...");
				await createEnrollment(
					payload,
					mockRequest,
					adminUser.id,
					secondCourse.id,
					"manager",
					"active",
				);
				console.log(
					`✅ Admin enrolled as manager in course ID: ${secondCourse.id}`,
				);
			}
		}

		console.log("🎓 Enrolling additional students...");
		const additionalEnrollments: Awaited<
			ReturnType<typeof tryCreateEnrollment>
		>["value"][] = [];
		for (let i = 0; i < additionalStudents.length; i++) {
			const student = additionalStudents[i];
			if (!student) continue;

			const status =
				data.enrollmentStatuses[i % data.enrollmentStatuses.length]!;
			const enrollment = await createEnrollment(
				payload,
				mockRequest,
				student.id,
				course.id,
				"student",
				status,
			);
			if (enrollment) {
				additionalEnrollments.push(enrollment);
				console.log(
					`✅ Additional student enrollment created with ID: ${enrollment.id}`,
				);
			}
		}

		// Create activity modules
		console.log("📄 Creating activity modules...");
		const { pageModule, additionalModules } = await createActivityModules(
			payload,
			{
				page: data.modules.page,
				additional: data.modules
					.additional as readonly SeedData["modules"]["additional"][number][],
			},
			adminUser.id,
			mockRequest,
		);
		if (!pageModule) {
			throw new Error("Failed to create page module");
		}
		console.log(`✅ Page module created with ID: ${pageModule.id}`);
		console.log(
			`✅ Additional modules created: ${additionalModules.length} modules`,
		);

		// Create sections
		console.log("📁 Creating course sections...");
		const sections = await createSections(
			payload,
			data.sections as readonly SeedData["sections"][number][],
			course.id,
		);
		for (const section of sections) {
			if (section) {
				console.log(`✅ Course section created with ID: ${section.id}`);
			}
		}

		// Link modules to sections
		console.log("🔗 Linking modules to course sections...");
		const allModules = [pageModule, ...additionalModules];
		const links = await linkModulesToSections(
			payload,
			mockRequest,
			course.id,
			allModules,
			sections,
		);
		for (const link of links) {
			if (link) {
				console.log(`✅ Module linked to section (ID: ${link.id})`);
			}
		}

		// Summary
		console.log("🎉 Seed process completed successfully!");
		console.log("📊 Summary:");
		console.log(`   - Admin user: ${adminUser.email} (ID: ${adminUser.id})`);
		console.log(
			`   - Student user: ${studentUser.email} (ID: ${studentUser.id})`,
		);
		console.log(
			`   - Teacher user: ${teacherUser.email} (ID: ${teacherUser.id})`,
		);
		console.log(`   - TA user: ${taUser.email} (ID: ${taUser.id})`);
		console.log(
			`   - Additional students: ${additionalStudents.length} created`,
		);
		console.log(`   - Courses: ${courses.length} created`);
		console.log(`   - Main course: ${course.title} (ID: ${course.id})`);
		console.log(
			`   - Student enrollment: Student enrolled as ${studentEnrollment.role}`,
		);
		console.log(
			`   - Teacher enrollment: Teacher enrolled as ${teacherEnrollment.role}`,
		);
		console.log(`   - TA enrollment: TA enrolled as ${taEnrollment.role}`);
		console.log(
			`   - Additional enrollments: ${additionalEnrollments.length} created`,
		);
		console.log(`   - Page module: ${pageModule.title} (ID: ${pageModule.id})`);
		console.log(`   - Additional modules: ${additionalModules.length} created`);
		console.log(`   - Course sections: ${sections.length} created`);
		console.log(
			`   - Course links: ${links.length} modules linked to sections`,
		);

		return {
			adminUser,
			studentUser,
			teacherUser,
			taUser,
			additionalStudents,
			courses,
			course,
			studentEnrollment,
			teacherEnrollment,
			taEnrollment,
			additionalEnrollments,
			pageModule,
			additionalModules,
			sections,
			links,
		};
	},
	(error) =>
		transformError(error) ??
		new SeedDataLoadError(
			`Seed process failed: ${error instanceof Error ? error.message : String(error)}`,
		),
);
