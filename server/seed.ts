import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "./internal/activity-module-management";
import { tryCheckFirstUser } from "./internal/check-first-user";
import { tryCreateCourseActivityModuleLink } from "./internal/course-activity-module-link-management";
import { tryCreateCategory } from "./internal/course-category-management";
import { tryCreateCourse } from "./internal/course-management";
import { tryCreateSection } from "./internal/course-section-management";
import { tryCreateEnrollment } from "./internal/enrollment-management";
import { tryCreateMedia } from "./internal/media-management";
import {
	tryCreateUser,
	tryRegisterFirstUser,
	tryUpdateUser,
} from "./internal/user-management";
import { devConstants } from "./utils/constants";
import vfs from "./vfs";

export interface RunSeedArgs {
	payload: Payload;
}

/**
 * Get file content from VFS as Buffer
 */
function getVfsFileBuffer(
	vfs: Record<string, string>,
	path: string,
): Buffer | null {
	const base64Content = vfs[path];
	if (!base64Content) return null;
	return Buffer.from(base64Content, "base64");
}

/**
 * Get file content from VFS as text
 */
function getVfsFileText(
	vfs: Record<string, string>,
	path: string,
): string | null {
	const buffer = getVfsFileBuffer(vfs, path);
	if (!buffer) return null;
	return buffer.toString("utf-8");
}

const testData = {
	admin: {
		firstName: "Alex",
		lastName: "Johnson",
	},
	users: {
		student: {
			email: "sarah.chen@example.com",
			password: "SecurePass123!",
			firstName: "Sarah",
			lastName: "Chen",
		},
		teacher: {
			email: "professor.martinez@example.com",
			password: "TeacherPass456!",
			firstName: "Maria",
			lastName: "Martinez",
		},
		ta: {
			email: "ta.williams@example.com",
			password: "TAPass789!",
			firstName: "David",
			lastName: "Williams",
		},
		additionalStudents: [
			{
				email: "james.taylor@example.com",
				password: "StudentPass001!",
				firstName: "James",
				lastName: "Taylor",
			},
			{
				email: "emily.davis@example.com",
				password: "StudentPass002!",
				firstName: "Emily",
				lastName: "Davis",
			},
			{
				email: "michael.brown@example.com",
				password: "StudentPass003!",
				firstName: "Michael",
				lastName: "Brown",
			},
			{
				email: "sophia.wilson@example.com",
				password: "StudentPass004!",
				firstName: "Sophia",
				lastName: "Wilson",
			},
			{
				email: "ethan.moore@example.com",
				password: "StudentPass005!",
				firstName: "Ethan",
				lastName: "Moore",
			},
		],
	},
	courses: [
		{
			title: "Introduction to Computer Science",
			description:
				"This comprehensive course provides a thorough introduction to the fundamental concepts of computer science. Students will explore programming basics, data structures, algorithms, and software engineering principles. The course is designed to build a strong foundation for further studies in computer science and related fields.",
			slug: "introduction-to-computer-science",
			status: "published" as const,
		},
		{
			title: "Advanced Data Structures and Algorithms",
			description:
				"An in-depth exploration of advanced data structures including trees, graphs, and hash tables. Students will learn to analyze algorithm complexity and implement efficient solutions to complex problems. This course builds upon fundamental programming concepts.",
			slug: "advanced-data-structures-and-algorithms",
			status: "published" as const,
		},
		{
			title: "Database Systems and Design",
			description:
				"Learn the principles of database design, normalization, and SQL query optimization. This course covers relational database management systems, data modeling, and transaction management. Students will gain practical experience designing and implementing database solutions.",
			slug: "database-systems-and-design",
			status: "published" as const,
		},
		{
			title: "Web Development Fundamentals",
			description:
				"A practical introduction to modern web development covering HTML, CSS, JavaScript, and responsive design principles. Students will learn to build interactive web applications using current best practices and frameworks. The course includes hands-on projects and real-world examples.",
			slug: "web-development-fundamentals",
			status: "draft" as const,
		},
		{
			title: "Machine Learning Basics",
			description:
				"Introduction to machine learning concepts including supervised and unsupervised learning, neural networks, and data preprocessing. Students will explore various algorithms and apply them to real-world datasets. This course requires prior knowledge of programming and statistics.",
			slug: "machine-learning-basics",
			status: "published" as const,
		},
		{
			title: "Software Engineering Practices",
			description:
				"Learn professional software development practices including version control, testing, code reviews, and project management. This course emphasizes collaborative development and industry-standard methodologies. Students will work on team projects throughout the semester.",
			slug: "software-engineering-practices",
			status: "published" as const,
		},
		{
			title: "Linear Algebra for Engineers",
			description:
				"A comprehensive study of linear algebra concepts essential for engineering applications. Topics include vector spaces, matrices, eigenvalues, and linear transformations. The course focuses on both theoretical understanding and practical problem-solving techniques.",
			slug: "linear-algebra-for-engineers",
			status: "archived" as const,
		},
	],
	modules: {
		page: {
			title: "Course Overview and Objectives",
			description:
				"An introduction to the course structure, learning objectives, and expected outcomes.",
			content:
				"Welcome to this course! This module provides an overview of the course content, learning objectives, and assessment methods. By the end of this course, you should have a comprehensive understanding of the subject matter and be able to apply the concepts learned in real-world scenarios.",
		},
		additional: [
			{
				type: "page" as const,
				title: "Introduction to Variables and Data Types",
				description:
					"Learn about different data types and how to declare and use variables in programming.",
				status: "published" as const,
				content:
					"Variables are fundamental building blocks in programming. They allow us to store and manipulate data. In this lesson, we'll explore primitive data types including integers, floating-point numbers, strings, and booleans. We'll also cover type conversion and best practices for variable naming.",
			},
			{
				type: "quiz" as const,
				title: "Data Types and Variables Quiz",
				description:
					"Test your understanding of variables and data types with this assessment.",
				status: "published" as const,
				instructions:
					"This quiz covers the concepts introduced in the data types module. Answer each question carefully and take your time. You have multiple attempts available.",
				points: 100,
				timeLimit: 45,
			},
			{
				type: "assignment" as const,
				title: "Programming Exercise: Calculator",
				description:
					"Build a simple calculator application to practice using variables and basic operations.",
				status: "published" as const,
				instructions:
					"Create a calculator program that can perform basic arithmetic operations (addition, subtraction, multiplication, division). The program should handle user input, perform calculations, and display results. Submit your code along with a brief explanation of your implementation.",
				dueDate: new Date("2025-12-15T23:59:59Z").toISOString(),
				maxAttempts: 3,
			},
			{
				type: "discussion" as const,
				title: "Discussing Best Practices in Programming",
				description:
					"Share your thoughts and experiences with coding practices and conventions.",
				status: "published" as const,
				instructions:
					"In this discussion, reflect on the importance of clean code and good programming practices. Share examples from your own experience or research. Engage with at least two other students' posts.",
				minReplies: 2,
				threadSorting: "recent" as const,
			},
			{
				type: "whiteboard" as const,
				title: "Visual Problem Solving",
				description:
					"Use the collaborative whiteboard to solve problems and brainstorm solutions.",
				status: "published" as const,
			},
			{
				type: "page" as const,
				title: "Control Flow and Conditionals",
				description:
					"Understanding how to control program flow using conditional statements.",
				status: "draft" as const,
				content:
					"Control flow structures allow programs to make decisions and execute code conditionally. This module covers if-else statements, switch cases, and ternary operators. We'll explore various scenarios and practice writing clear, efficient conditional logic.",
			},
			{
				type: "quiz" as const,
				title: "Control Flow Assessment",
				description:
					"Evaluate your understanding of conditional statements and program flow.",
				status: "published" as const,
				instructions:
					"This quiz tests your ability to trace program execution and predict outcomes based on conditional logic. Pay attention to edge cases and nested conditions.",
				points: 85,
				timeLimit: 60,
			},
			{
				type: "assignment" as const,
				title: "Grade Calculator Project",
				description:
					"Create a program that calculates and displays letter grades based on numeric scores.",
				status: "published" as const,
				instructions:
					"Design and implement a grade calculator that takes numeric scores as input and determines the corresponding letter grade. Include error handling for invalid inputs and provide clear feedback to the user. Submit your working code with comments explaining your logic.",
				dueDate: new Date("2025-12-20T23:59:59Z").toISOString(),
				maxAttempts: 2,
			},
		],
	},
	sections: [
		{
			title: "Introduction",
			description: "Welcome materials and course overview to get you started.",
		},
		{
			title: "Course Content",
			description:
				"Core learning materials and instructional content for the course.",
		},
		{
			title: "Assignments",
			description:
				"Homework assignments and projects to reinforce your learning.",
		},
		{
			title: "Discussions",
			description: "Interactive discussions and peer engagement activities.",
		},
	],
	enrollmentStatuses: ["active", "inactive", "completed"] as const,
} as const;

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
			firstName: testData.admin.firstName,
			lastName: testData.admin.lastName,
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
		const adminAvatarBuffer = getVfsFileBuffer(vfs, "fixture/paideia-logo.png");
		if (!adminAvatarBuffer) {
			throw new Error("Failed to load paideia-logo.png from VFS");
		}
		const adminAvatarResult = await tryCreateMedia(payload, {
			file: adminAvatarBuffer,
			filename: "paideia-logo.png",
			mimeType: "image/png",
			alt: "Admin avatar",
			userId: adminUser.id,
		});

		if (adminAvatarResult.ok) {
			const updateAdminResult = await tryUpdateUser({
				payload,
				userId: adminUser.id,
				data: {
					avatar: adminAvatarResult.value.media.id,
				},
				overrideAccess: true,
			});

			if (updateAdminResult.ok) {
				console.log(
					`✅ Admin avatar assigned with media ID: ${adminAvatarResult.value.media.id}`,
				);
			}
		}

		// Step 2: Create second user (student)
		console.log("👤 Creating student user...");
		const studentResult = await tryCreateUser({
			payload,
			data: {
				email: testData.users.student.email,
				password: testData.users.student.password,
				firstName: testData.users.student.firstName,
				lastName: testData.users.student.lastName,
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
		const studentAvatarBuffer = getVfsFileBuffer(vfs, "fixture/gem.png");
		if (!studentAvatarBuffer) {
			throw new Error("Failed to load gem.png from VFS");
		}
		const studentAvatarResult = await tryCreateMedia(payload, {
			file: studentAvatarBuffer,
			filename: "gem.png",
			mimeType: "image/png",
			alt: "Student avatar",
			userId: studentUser.id,
		});

		if (studentAvatarResult.ok) {
			const updateStudentResult = await tryUpdateUser({
				payload,
				userId: studentUser.id,
				data: {
					avatar: studentAvatarResult.value.media.id,
				},
				overrideAccess: true,
			});

			if (updateStudentResult.ok) {
				console.log(
					`✅ Student avatar assigned with media ID: ${studentAvatarResult.value.media.id}`,
				);
			}
		}

		// Step 3: Create teacher user
		console.log("👤 Creating teacher user...");
		const teacherResult = await tryCreateUser({
			payload,
			data: {
				email: testData.users.teacher.email,
				password: testData.users.teacher.password,
				firstName: testData.users.teacher.firstName,
				lastName: testData.users.teacher.lastName,
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
				email: testData.users.ta.email,
				password: testData.users.ta.password,
				firstName: testData.users.ta.firstName,
				lastName: testData.users.ta.lastName,
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
		for (let i = 0; i < testData.users.additionalStudents.length; i++) {
			const studentData = testData.users.additionalStudents[i];
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
			const courseData = testData.courses[i];
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
			const uncategorizedCourseData = testData.courses[6];
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
				testData.enrollmentStatuses[i % testData.enrollmentStatuses.length];
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
			title: testData.modules.page.title,
			description: testData.modules.page.description,
			type: "page",
			status: "published",
			userId: adminUser.id,
			pageData: {
				content: testData.modules.page.content,
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

		for (let i = 0; i < testData.modules.additional.length; i++) {
			const moduleData = testData.modules.additional[i];
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
					const fixtureContent = getVfsFileText(
						vfs,
						"fixture/whiteboard-data.json",
					);
					if (!fixtureContent) {
						throw new Error("Failed to load whiteboard-data.json from VFS");
					}
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
				moduleArgs = {
					...baseArgs,
					type: "quiz" as const,
					quizData: {
						instructions: moduleData.instructions,
						points: moduleData.points,
						timeLimit: moduleData.timeLimit,
					},
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

		for (let i = 0; i < testData.sections.length; i++) {
			const sectionData = testData.sections[i];
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
		new Error(
			`Seed process failed: ${error instanceof Error ? error.message : String(error)}`,
		),
);
