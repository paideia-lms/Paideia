import { SeedDataLoadError, transformError } from "app/utils/error";
import type { Simplify } from "node_modules/drizzle-orm/utils";
import type { Payload } from "payload";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import { Result } from "typescript-result";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
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

export { testData };

/**
 * Seeds the development database with initial data
 * Only runs if the database is fresh (no users exist)
 */
export const tryRunSeed = Result.wrap(
	async (args: RunSeedArgs) => {
		const { payload, seedData } = args;

		// Use provided seedData or fall back to testData
		const data = seedData ?? testData;

		console.log("🌱 Checking if database needs seeding...");

		// Check if database is fresh
		const needsSeeding = await tryCheckFirstUser({
			payload,
			overrideAccess: true,
		});

		if (!needsSeeding.ok) {
			throw new Error(
				`Failed to check first user: ${needsSeeding.error.message}`,
			);
		}

		if (!needsSeeding.value) {
			console.log("✅ Database already has users, skipping seed");
			return;
		}

		console.log("🌱 Database is fresh, starting seed process...");

		// Create a mock request object for functions that require it
		const mockRequest = new Request("http://localhost:3000");

		// Step 1: Register first admin user
		console.log("👤 Creating admin user...");
		const adminResult = await tryRegisterFirstUser({
			payload,
			req: mockRequest,
			email: data.admin.email,
			password: data.admin.password,
			firstName: data.admin.firstName,
			lastName: data.admin.lastName,
		});

		if (!adminResult.ok) {
			throw new Error(
				`Failed to create admin user: ${adminResult.error.message}`,
			);
		}

		const adminUser = adminResult.value.user;
		console.log(`✅ Admin user created with ID: ${adminUser.id}`);

		// Step 1.5: Create and assign admin avatar
		console.log("🖼️  Creating admin avatar...");
		const adminAvatarBuffer = await getVfsFileBuffer(
			vfs,
			"fixture/paideia-logo.png",
		);
		if (adminAvatarBuffer) {
			const adminAvatarResult = await tryCreateMedia({
				payload,
				file: adminAvatarBuffer,
				filename: "paideia-logo.png",
				mimeType: "image/png",
				alt: "Admin avatar",
				userId: adminUser.id,
				// ! this is a seeding process, we can override access
				overrideAccess: true,
			});

			if (adminAvatarResult.ok) {
				const updateAdminResult = await tryUpdateUser({
					payload,
					userId: adminUser.id,
					data: {
						avatar: adminAvatarResult.value.media.id,
					},
					// ! this is a seeding process, we can override access because it is not part of the test suite and is not affected by the test suite.
					overrideAccess: true,
				});

				if (updateAdminResult.ok) {
					console.log(
						`✅ Admin avatar assigned with media ID: ${adminAvatarResult.value.media.id}`,
					);
				}
			}
		} else {
			console.log(
				"⚠️  Skipping admin avatar creation: paideia-logo.png not found in VFS or file system",
			);
		}

		// Step 2: Create second user (student)
		console.log("👤 Creating student user...");
		const studentResult = await tryCreateUser({
			payload,
			data: {
				email: data.users.student.email,
				password: data.users.student.password,
				firstName: data.users.student.firstName,
				lastName: data.users.student.lastName,
				role: "student",
			},
			req: mockRequest,
			overrideAccess: true,
		});

		if (!studentResult.ok) {
			throw new Error(
				`Failed to create student user: ${studentResult.error.message}`,
			);
		}

		const studentUser = studentResult.value;
		console.log(`✅ Student user created with ID: ${studentUser.id}`);

		// Step 2.5: Create and assign student avatar
		console.log("🖼️  Creating student avatar...");
		const studentAvatarBuffer = await getVfsFileBuffer(vfs, "fixture/gem.png");
		if (studentAvatarBuffer) {
			const studentAvatarResult = await tryCreateMedia({
				payload,
				file: studentAvatarBuffer,
				filename: "gem.png",
				mimeType: "image/png",
				alt: "Student avatar",
				userId: studentUser.id,
				// ! this is a seeding process, we can override access
				overrideAccess: true,
			});

			if (studentAvatarResult.ok) {
				const updateStudentResult = await tryUpdateUser({
					payload,
					userId: studentUser.id,
					data: {
						avatar: studentAvatarResult.value.media.id,
					},
					// ! this is a seeding process, we can override access because it is not part of the test suite and is not affected by the test suite.
					overrideAccess: true,
				});

				if (updateStudentResult.ok) {
					console.log(
						`✅ Student avatar assigned with media ID: ${studentAvatarResult.value.media.id}`,
					);
				}
			}
		} else {
			console.log(
				"⚠️  Skipping student avatar creation: gem.png not found in VFS or file system",
			);
		}

		// Step 3: Create teacher user
		console.log("👤 Creating teacher user...");
		const teacherResult = await tryCreateUser({
			payload,
			data: {
				email: data.users.teacher.email,
				password: data.users.teacher.password,
				firstName: data.users.teacher.firstName,
				lastName: data.users.teacher.lastName,
				role: "student", // Users start as students, role is set via enrollment
			},
			req: mockRequest,
			overrideAccess: true,
		});

		if (!teacherResult.ok) {
			throw new Error(
				`Failed to create teacher user: ${teacherResult.error.message}`,
			);
		}

		const teacherUser = teacherResult.value;
		console.log(`✅ Teacher user created with ID: ${teacherUser.id}`);

		// Step 4: Create TA user
		console.log("👤 Creating TA user...");
		const taResult = await tryCreateUser({
			payload,
			data: {
				email: data.users.ta.email,
				password: data.users.ta.password,
				firstName: data.users.ta.firstName,
				lastName: data.users.ta.lastName,
				role: "student", // Users start as students, role is set via enrollment
			},
			req: mockRequest,
			overrideAccess: true,
		});

		if (!taResult.ok) {
			throw new Error(`Failed to create TA user: ${taResult.error.message}`);
		}

		const taUser = taResult.value;
		console.log(`✅ TA user created with ID: ${taUser.id}`);

		// Step 4.5: Create additional students
		console.log("👤 Creating additional students...");
		const additionalStudents = [];
		for (let i = 0; i < data.users.additionalStudents.length; i++) {
			const studentData = data.users.additionalStudents[i];
			const studentResult = await tryCreateUser({
				payload,
				data: {
					email: studentData.email,
					password: studentData.password,
					firstName: studentData.firstName,
					lastName: studentData.lastName,
					role: "student",
				},
				req: mockRequest,
				overrideAccess: true,
			});

			if (studentResult.ok) {
				additionalStudents.push(studentResult.value);
				console.log(
					`✅ Additional student created with ID: ${studentResult.value.id}`,
				);
			}
		}

		// Step 5: Create course categories
		console.log("🏷️  Creating course categories...");
		const categoryResults: { name: string; id: number }[] = [];
		const stemCategory = await tryCreateCategory(payload, mockRequest, {
			name: "STEM",
		});
		if (stemCategory.ok) {
			categoryResults.push({ name: "STEM", id: stemCategory.value.id });
			console.log(`✅ Category created: STEM (ID: ${stemCategory.value.id})`);
		}
		const humanitiesCategory = await tryCreateCategory(payload, mockRequest, {
			name: "Humanities",
		});
		if (humanitiesCategory.ok) {
			categoryResults.push({
				name: "Humanities",
				id: humanitiesCategory.value.id,
			});
			console.log(
				`✅ Category created: Humanities (ID: ${humanitiesCategory.value.id})`,
			);
		}
		const csSubcat = stemCategory.ok
			? await tryCreateCategory(payload, mockRequest, {
					name: "Computer Science",
					parent: stemCategory.value.id,
				})
			: null;
		if (csSubcat && csSubcat.ok) {
			categoryResults.push({ name: "Computer Science", id: csSubcat.value.id });
			console.log(
				`✅ Subcategory created: Computer Science (ID: ${csSubcat.value.id})`,
			);
		}
		const mathSubcat = stemCategory.ok
			? await tryCreateCategory(payload, mockRequest, {
					name: "Mathematics",
					parent: stemCategory.value.id,
				})
			: null;
		if (mathSubcat && mathSubcat.ok) {
			categoryResults.push({ name: "Mathematics", id: mathSubcat.value.id });
			console.log(
				`✅ Subcategory created: Mathematics (ID: ${mathSubcat.value.id})`,
			);
		}

		// Step 6: Create multiple courses and assign categories
		console.log("📚 Creating courses...");
		const courses = [];
		for (let i = 0; i < 6; i++) {
			const courseData = data.courses[i];
			const randomCategoryId =
				categoryResults.length > 0
					? categoryResults[i % categoryResults.length].id
					: undefined;
			const courseResult = await tryCreateCourse({
				payload,
				data: {
					title: courseData.title,
					description: courseData.description,
					slug: courseData.slug,
					createdBy: adminUser.id,
					status: courseData.status,
					// Assign to a category if available
					category: randomCategoryId,
				},
				overrideAccess: true,
			});

			if (courseResult.ok) {
				courses.push(courseResult.value);
				console.log(`✅ Course created with ID: ${courseResult.value.id}`);
			}
		}

		// Additionally create an uncategorized course (no category assigned)
		console.log("📚 Creating uncategorized course...");
		{
			const uncategorizedCourseData = data.courses[6];
			const uncategorizedCourseResult = await tryCreateCourse({
				payload,
				data: {
					title: uncategorizedCourseData.title,
					description: uncategorizedCourseData.description,
					slug: uncategorizedCourseData.slug,
					createdBy: adminUser.id,
					status: uncategorizedCourseData.status,
					// Intentionally omit category to create an uncategorized course
				},
				overrideAccess: true,
			});

			if (uncategorizedCourseResult.ok) {
				courses.push(uncategorizedCourseResult.value);
				console.log(
					`✅ Uncategorized course created with ID: ${uncategorizedCourseResult.value.id}`,
				);
			}
		}

		const course = courses[0]; // Use first course for enrollments

		// Step 6: Enroll student in course
		console.log("🎓 Enrolling student in course...");
		const studentEnrollmentResult = await tryCreateEnrollment({
			payload,
			user: studentUser.id,
			course: course.id,
			role: "student",
			status: "active",
			req: mockRequest,
			overrideAccess: true,
		});

		if (!studentEnrollmentResult.ok) {
			throw new Error(
				`Failed to create student enrollment: ${studentEnrollmentResult.error.message}`,
			);
		}

		const studentEnrollment = studentEnrollmentResult.value;
		console.log(
			`✅ Student enrollment created with ID: ${studentEnrollment.id}`,
		);

		// Step 7: Enroll teacher in course
		console.log("🎓 Enrolling teacher in course...");
		const teacherEnrollmentResult = await tryCreateEnrollment({
			payload,
			user: teacherUser.id,
			course: course.id,
			role: "teacher",
			status: "active",
			req: mockRequest,
			overrideAccess: true,
		});

		if (!teacherEnrollmentResult.ok) {
			throw new Error(
				`Failed to create teacher enrollment: ${teacherEnrollmentResult.error.message}`,
			);
		}

		const teacherEnrollment = teacherEnrollmentResult.value;
		console.log(
			`✅ Teacher enrollment created with ID: ${teacherEnrollment.id}`,
		);

		// Step 8: Enroll TA in course
		console.log("🎓 Enrolling TA in course...");
		const taEnrollmentResult = await tryCreateEnrollment({
			payload,
			user: taUser.id,
			course: course.id,
			role: "ta",
			status: "active",
			req: mockRequest,
			overrideAccess: true,
		});

		if (!taEnrollmentResult.ok) {
			throw new Error(
				`Failed to create TA enrollment: ${taEnrollmentResult.error.message}`,
			);
		}

		const taEnrollment = taEnrollmentResult.value;
		console.log(`✅ TA enrollment created with ID: ${taEnrollment.id}`);

		// Step 8.6: Enroll admin as manager in another course
		if (courses.length > 1) {
			console.log("🧑‍💼 Enrolling admin as manager in a course...");
			const managerEnrollmentResult = await tryCreateEnrollment({
				payload,
				user: adminUser.id,
				course: courses[1].id,
				role: "manager",
				status: "active",
				req: mockRequest,
				overrideAccess: true,
			});
			if (managerEnrollmentResult.ok) {
				console.log(
					`✅ Admin enrolled as manager in course ID: ${courses[1].id} (enrollment ID: ${managerEnrollmentResult.value.id})`,
				);
			}
		}

		// Step 8.5: Enroll additional students
		console.log("🎓 Enrolling additional students...");
		const additionalEnrollments = [];
		for (let i = 0; i < additionalStudents.length; i++) {
			const student = additionalStudents[i];
			const status =
				data.enrollmentStatuses[i % data.enrollmentStatuses.length];
			const enrollmentResult = await tryCreateEnrollment({
				payload,
				user: student.id,
				course: course.id,
				role: "student",
				status,
				req: mockRequest,
				overrideAccess: true,
			});

			if (enrollmentResult.ok) {
				additionalEnrollments.push(enrollmentResult.value);
				console.log(
					`✅ Additional student enrollment created with ID: ${enrollmentResult.value.id}`,
				);
			}
		}

		// Step 9: Create page module
		console.log("📄 Creating page module...");
		const pageModuleResult = await tryCreateActivityModule(payload, {
			title: data.modules.page.title,
			description: data.modules.page.description,
			type: "page",
			status: "published",
			userId: adminUser.id,
			pageData: {
				content: data.modules.page.content,
			},
		});

		if (!pageModuleResult.ok) {
			throw new Error(
				`Failed to create page module: ${pageModuleResult.error.message}`,
			);
		}

		const pageModule = pageModuleResult.value;
		console.log(`✅ Page module created with ID: ${pageModule.id}`);

		// Step 9.5: Create additional activity modules
		console.log("📄 Creating additional activity modules...");
		const additionalModules = [];

		// Track if we've loaded the fixture whiteboard data
		let whiteboardFixtureLoaded = false;

		for (let i = 0; i < data.modules.additional.length; i++) {
			const moduleData = data.modules.additional[i];
			const baseArgs = {
				title: moduleData.title,
				description: moduleData.description,
				status: moduleData.status,
				userId: adminUser.id,
			};

			let moduleArgs: CreateActivityModuleArgs;
			if (moduleData.type === "page") {
				moduleArgs = {
					...baseArgs,
					type: "page" as const,
					pageData: { content: moduleData.content },
				};
			} else if (moduleData.type === "whiteboard") {
				// Use fixture whiteboard data for the first whiteboard
				let whiteboardContent: string;
				if (whiteboardFixtureLoaded) {
					whiteboardContent = JSON.stringify({ shapes: [], bindings: [] });
				} else {
					const fixtureContent = await getVfsFileText(
						vfs,
						"fixture/whiteboard-data.json",
					);
					if (!fixtureContent) {
						console.log(
							"⚠️  Skipping whiteboard fixture: whiteboard-data.json not found in VFS or file system, using empty default",
						);
						whiteboardContent = JSON.stringify({ shapes: [], bindings: [] });
					} else {
						// Validate and parse JSON to ensure it's valid before saving
						try {
							const parsed = JSON.parse(fixtureContent);
							// Re-stringify to ensure consistent formatting
							whiteboardContent = JSON.stringify(parsed);
						} catch (error) {
							console.error("Invalid JSON in whiteboard-data.json:", error);
							// Fallback to empty content if JSON is invalid
							whiteboardContent = JSON.stringify({ shapes: [], bindings: [] });
						}
					}
					whiteboardFixtureLoaded = true;
				}

				moduleArgs = {
					...baseArgs,
					type: "whiteboard" as const,
					whiteboardData: {
						content: whiteboardContent,
					},
				};
			} else if (moduleData.type === "assignment") {
				moduleArgs = {
					...baseArgs,
					type: "assignment" as const,
					assignmentData: {
						instructions: moduleData.instructions,
						dueDate: moduleData.dueDate,
						maxAttempts: moduleData.maxAttempts,
					},
				};
			} else if (moduleData.type === "quiz") {
				const quizData: {
					instructions?: string;
					points?: number;
					timeLimit?: number;
					rawQuizConfig?: QuizConfig;
				} = {
					instructions: moduleData.instructions,
					points: moduleData.points,
					timeLimit: moduleData.timeLimit,
				};
				if (moduleData.rawQuizConfig) {
					quizData.rawQuizConfig = moduleData.rawQuizConfig as QuizConfig;
				}
				moduleArgs = {
					...baseArgs,
					type: "quiz" as const,
					quizData,
				};
			} else {
				moduleArgs = {
					...baseArgs,
					type: "discussion" as const,
					discussionData: {
						instructions: moduleData.instructions,
						minReplies: moduleData.minReplies,
						threadSorting: moduleData.threadSorting,
					},
				};
			}

			const moduleResult = await tryCreateActivityModule(payload, moduleArgs);

			if (moduleResult.ok) {
				additionalModules.push(moduleResult.value);
				console.log(
					`✅ Additional module created with ID: ${moduleResult.value.id} (${moduleResult.value.type})`,
				);
			}
		}

		// Step 10: Create sections for the course
		console.log("📁 Creating course sections...");
		const sections = [];

		for (let i = 0; i < data.sections.length; i++) {
			const sectionData = data.sections[i];
			const sectionResult = await tryCreateSection({
				payload,
				data: {
					course: course.id,
					title: sectionData.title,
					description: sectionData.description,
				},
				overrideAccess: true,
			});

			if (sectionResult.ok) {
				sections.push(sectionResult.value);
				console.log(
					`✅ Course section created with ID: ${sectionResult.value.id} (${sectionData.title})`,
				);
			}
		}

		// Step 11: Link modules to course sections
		console.log("🔗 Linking modules to course sections...");
		const links = [];
		const allModules = [pageModule, ...additionalModules];

		// Distribute modules across sections
		for (let i = 0; i < allModules.length; i++) {
			const module = allModules[i];
			const sectionIndex = i % sections.length;
			const section = sections[sectionIndex];

			const linkResult = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				{
					course: course.id,
					activityModule: module.id,
					section: section.id,
					order: Math.floor(i / sections.length), // Distribute order within each section
				},
			);

			if (linkResult.ok) {
				links.push(linkResult.value);
				console.log(
					`✅ Module ${module.title} linked to section ${section.title}`,
				);
			}
		}

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
