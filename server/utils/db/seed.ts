import { SeedDataLoadError, transformError } from "app/utils/error";
import type { Simplify } from "node_modules/drizzle-orm/utils";
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
import { tryCheckFirstUser } from "../../internal/check-first-user";
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
 * Helper to throw error if result is not ok
 */
function assertResultOk<T>(
	result: Result<T, Error>,
	errorMessage: string,
): asserts result is Result<T, Error> & { ok: true; value: T } {
	if (!result.ok) {
		throw new Error(`${errorMessage}: ${result.error.message}`);
	}
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
	const userResult = await tryCreateUser({
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
	});

	assertResultOk(userResult, `Failed to create user ${userData.email}`);

	if (avatarPath && avatarFilename) {
		const avatarBuffer = await getVfsFileBuffer(vfs, avatarPath);
		if (avatarBuffer) {
			const mediaResult = await tryCreateMedia({
				payload,
				file: avatarBuffer,
				filename: avatarFilename,
				mimeType: "image/png",
				alt: `${userData.firstName} ${userData.lastName} avatar`,
				userId: userResult.value.id,
				overrideAccess: true,
			});

			assertResultOk(
				mediaResult,
				`Failed to create avatar for ${userData.email}`,
			);

			const updateResult = await tryUpdateUser({
				payload,
				userId: userResult.value.id,
				data: { avatar: mediaResult.value.media.id },
				overrideAccess: true,
			});

			assertResultOk(
				updateResult,
				`Failed to update avatar for ${userData.email}`,
			);
		}
	}

	return userResult.value;
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
	const adminResult = await tryRegisterFirstUser({
		payload,
		req,
		email: adminData.email,
		password: adminData.password,
		firstName: adminData.firstName,
		lastName: adminData.lastName,
	});

	assertResultOk(adminResult, "Failed to create admin user");

	const adminUser = adminResult.value.user;

	// Create and assign admin avatar
	const avatarBuffer = await getVfsFileBuffer(vfs, "fixture/paideia-logo.png");
	if (avatarBuffer) {
		const mediaResult = await tryCreateMedia({
			payload,
			file: avatarBuffer,
			filename: "paideia-logo.png",
			mimeType: "image/png",
			alt: "Admin avatar",
			userId: adminUser.id,
			overrideAccess: true,
		});

		if (mediaResult.ok) {
			const updateResult = await tryUpdateUser({
				payload,
				userId: adminUser.id,
				data: { avatar: mediaResult.value.media.id },
				overrideAccess: true,
			});

			if (updateResult.ok) {
				console.log(
					`✅ Admin avatar assigned with media ID: ${mediaResult.value.media.id}`,
				);
			}
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

	const stemCategory = await tryCreateCategory({
		payload,
		req,
		name: "STEM",
		overrideAccess: true,
	});
	assertResultOk(stemCategory, "Failed to create STEM category");
	categories.push({ name: "STEM", id: stemCategory.value.id });

	const humanitiesCategory = await tryCreateCategory({
		payload,
		req,
		name: "Humanities",
		overrideAccess: true,
	});
	assertResultOk(humanitiesCategory, "Failed to create Humanities category");
	categories.push({ name: "Humanities", id: humanitiesCategory.value.id });

	const csSubcat = await tryCreateCategory({
		payload,
		req,
		name: "Computer Science",
		parent: stemCategory.value.id,
		overrideAccess: true,
	});
	assertResultOk(csSubcat, "Failed to create Computer Science subcategory");
	categories.push({ name: "Computer Science", id: csSubcat.value.id });

	const mathSubcat = await tryCreateCategory({
		payload,
		req,
		name: "Mathematics",
		parent: stemCategory.value.id,
		overrideAccess: true,
	});
	assertResultOk(mathSubcat, "Failed to create Mathematics subcategory");
	categories.push({ name: "Mathematics", id: mathSubcat.value.id });

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

		const courseResult = await tryCreateCourse({
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
		});

		assertResultOk(
			courseResult,
			`Failed to create course "${courseData.title}"`,
		);
		courses.push(courseResult.value);
	}

	// Create uncategorized course
	const uncategorizedCourseData = coursesData[6]!;
	const uncategorizedResult = await tryCreateCourse({
		payload,
		data: {
			title: uncategorizedCourseData.title,
			description: uncategorizedCourseData.description,
			slug: uncategorizedCourseData.slug,
			createdBy: adminUserId,
			status: uncategorizedCourseData.status,
		},
		overrideAccess: true,
	});

	assertResultOk(uncategorizedResult, "Failed to create uncategorized course");
	courses.push(uncategorizedResult.value);

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
	const enrollmentResult = await tryCreateEnrollment({
		payload,
		userId,
		course: courseId,
		role,
		status,
		user: null,
		req,
		overrideAccess: true,
	});

	assertResultOk(
		enrollmentResult,
		`Failed to create ${role} enrollment for user ${userId}`,
	);

	return enrollmentResult.value;
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
	const pageModuleResult = await tryCreatePageModule({
		...baseArgs,
		title: modulesData.page.title,
		description: modulesData.page.description,
		status: "published",
		content: modulesData.page.content,
	});

	assertResultOk(pageModuleResult, "Failed to create page module");

	// Create additional modules
	const additionalModules: ActivityModuleResult[] = [];
	const whiteboardLoader = createWhiteboardFixtureLoader();

	for (const moduleData of modulesData.additional) {
		let moduleResult:
			| Awaited<ReturnType<typeof tryCreatePageModule>>
			| Awaited<ReturnType<typeof tryCreateWhiteboardModule>>
			| Awaited<ReturnType<typeof tryCreateAssignmentModule>>
			| Awaited<ReturnType<typeof tryCreateQuizModule>>
			| Awaited<ReturnType<typeof tryCreateDiscussionModule>>;

		switch (moduleData.type) {
			case "page": {
				moduleResult = await tryCreatePageModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					content: moduleData.content,
				});
				break;
			}
			case "whiteboard": {
				const whiteboardContent = await whiteboardLoader();
				moduleResult = await tryCreateWhiteboardModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					content: whiteboardContent,
				});
				break;
			}
			case "assignment": {
				moduleResult = await tryCreateAssignmentModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					instructions: moduleData.instructions,
				});
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
				moduleResult = await tryCreateQuizModule(quizArgs);
				break;
			}
			case "discussion": {
				moduleResult = await tryCreateDiscussionModule({
					...baseArgs,
					title: moduleData.title,
					description: moduleData.description,
					status: moduleData.status,
					instructions: moduleData.instructions,
					minReplies: moduleData.minReplies,
					threadSorting: moduleData.threadSorting,
				});
				break;
			}
			default:
				throw new Error(
					`Unknown module type: ${(moduleData as { type: string }).type}`,
				);
		}

		if (!moduleResult.ok) {
			throw new Error(
				`Failed to create additional module "${moduleData.title}": ${moduleResult.error.message}`,
			);
		}

		additionalModules.push(moduleResult.value as ActivityModuleResult);
	}

	return {
		pageModule: pageModuleResult.value,
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
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: courseId,
				title: sectionData.title,
				description: sectionData.description,
			},
			overrideAccess: true,
		});

		assertResultOk(
			sectionResult,
			`Failed to create course section "${sectionData.title}"`,
		);

		sections.push(sectionResult.value);
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

		const linkResult = await tryCreateCourseActivityModuleLink({
			payload,
			req,
			course: courseId,
			activityModule: module.id,
			section: section.id,
			order: Math.floor(i / sections.length),
			overrideAccess: true,
		});

		assertResultOk(
			linkResult,
			`Failed to link module "${module.title}" to section "${section.title}"`,
		);

		links.push(linkResult.value);
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

		const needsSeeding = await tryCheckFirstUser({
			payload,
			overrideAccess: true,
		});

		assertResultOk(needsSeeding, "Failed to check first user");

		if (!needsSeeding.value) {
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
