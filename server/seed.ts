import type { Payload } from "payload";
import { Result } from "typescript-result";
import { tryCreateActivityModule } from "./internal/activity-module-management";
import { tryCheckFirstUser } from "./internal/check-first-user";
import { tryCreateCourseActivityModuleLink } from "./internal/course-activity-module-link-management";
import { tryCreateCourse } from "./internal/course-management";
import { tryCreateEnrollment } from "./internal/enrollment-management";
import {
	tryCreateUser,
	tryRegisterFirstUser,
} from "./internal/user-management";
import { devConstants } from "./utils/constants";

export interface RunSeedArgs {
	payload: Payload;
}

/**
 * Seeds the development database with initial data
 * Only runs if the database is fresh (no users exist)
 */
export const runSeed = Result.wrap(
	async (args: RunSeedArgs) => {
		const { payload } = args;

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
			email: devConstants.ADMIN_EMAIL,
			password: devConstants.ADMIN_PASSWORD,
			firstName: "Admin",
			lastName: "User",
		});

		if (!adminResult.ok) {
			throw new Error(
				`Failed to create admin user: ${adminResult.error.message}`,
			);
		}

		const adminUser = adminResult.value.user;
		console.log(`✅ Admin user created with ID: ${adminUser.id}`);

		// Step 2: Create second user (student)
		console.log("👤 Creating student user...");
		const studentResult = await tryCreateUser({
			payload,
			data: {
				email: "student@example.com",
				password: "studentpassword123",
				firstName: "Student",
				lastName: "User",
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

		// Step 3: Create teacher user
		console.log("👤 Creating teacher user...");
		const teacherResult = await tryCreateUser({
			payload,
			data: {
				email: "teacher@example.com",
				password: "teacherpassword123",
				firstName: "Teacher",
				lastName: "User",
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
				email: "ta@example.com",
				password: "tapassword123",
				firstName: "Teaching",
				lastName: "Assistant",
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

		// Step 5: Create a course
		console.log("📚 Creating course...");
		const courseResult = await tryCreateCourse(payload, mockRequest, {
			title: "Introduction to Programming",
			description: "Learn the basics of programming",
			slug: "intro-to-programming",
			createdBy: adminUser.id,
			status: "published",
		});

		if (!courseResult.ok) {
			throw new Error(`Failed to create course: ${courseResult.error.message}`);
		}

		const course = courseResult.value;
		console.log(`✅ Course created with ID: ${course.id}`);

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

		// Step 9: Create page module
		console.log("📄 Creating page module...");
		const pageModuleResult = await tryCreateActivityModule(payload, {
			title: "Welcome to the Course",
			description: "Introduction and course overview",
			type: "page",
			status: "published",
			userId: adminUser.id,
		});

		if (!pageModuleResult.ok) {
			throw new Error(
				`Failed to create page module: ${pageModuleResult.error.message}`,
			);
		}

		const pageModule = pageModuleResult.value;
		console.log(`✅ Page module created with ID: ${pageModule.id}`);

		// Step 10: Link page module to course
		console.log("🔗 Linking page module to course...");
		const linkResult = await tryCreateCourseActivityModuleLink(
			payload,
			mockRequest,
			{
				course: course.id,
				activityModule: pageModule.id,
			},
		);

		if (!linkResult.ok) {
			throw new Error(
				`Failed to create course-activity-module link: ${linkResult.error.message}`,
			);
		}

		const link = linkResult.value;
		console.log(`✅ Course-activity-module link created with ID: ${link.id}`);

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
		console.log(`   - Course: ${course.title} (ID: ${course.id})`);
		console.log(
			`   - Student enrollment: Student enrolled as ${studentEnrollment.role}`,
		);
		console.log(
			`   - Teacher enrollment: Teacher enrolled as ${teacherEnrollment.role}`,
		);
		console.log(`   - TA enrollment: TA enrolled as ${taEnrollment.role}`);
		console.log(`   - Page module: ${pageModule.title} (ID: ${pageModule.id})`);
		console.log(`   - Course link: Course linked to page module`);

		return {
			adminUser,
			studentUser,
			teacherUser,
			taUser,
			course,
			studentEnrollment,
			teacherEnrollment,
			taEnrollment,
			pageModule,
			link,
		};
	},
	(error) =>
		new Error(
			`Seed process failed: ${error instanceof Error ? error.message : String(error)}`,
		),
);
