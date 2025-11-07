import { devConstants } from "../constants";

export const testData = {
	admin: {
		email: devConstants.ADMIN_EMAIL,
		password: devConstants.ADMIN_PASSWORD,
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
