import type { QuizConfig } from "server/json/raw-quiz-config/types.v2";
import { devConstants } from "../constants";

// Sample Nested Quiz Config for testing and seeding
export const sampleNestedQuizConfig: QuizConfig = {
	version: "v2",
	type: "container",
	id: "sample-nested-quiz",
	title: "Multi-Section Exam",
	globalTimer: 30, // 30 seconds total for all quizzes
	sequentialOrder: false, // Must complete quizzes in order
	grading: {
		enabled: true,
		passingScore: 60,
		showScoreToStudent: true,
		showCorrectAnswers: false,
	},
	nestedQuizzes: [
		{
			id: "section-1",
			title: "Section 1: Basic Concepts",
			description: "Fundamental programming concepts and syntax",
			globalTimer: 10, // 10 seconds for testing
			grading: {
				enabled: true,
				passingScore: 70,
				showScoreToStudent: true,
				showCorrectAnswers: true,
			},
			pages: [
				{
					id: "s1-page-1",
					title: "Variables and Data Types",
					questions: [
						{
							id: "s1-q1",
							type: "multiple-choice",
							prompt:
								"Which of the following is NOT a primitive data type in JavaScript?",
							options: {
								a: "String",
								b: "Number",
								c: "Array",
								d: "Boolean",
							},
							correctAnswer: "c",
							scoring: { type: "simple", points: 2 },
						},
						{
							id: "s1-q2",
							type: "short-answer",
							prompt:
								"What keyword is used to declare a constant in JavaScript?",
							correctAnswer: "const",
							scoring: { type: "simple", points: 3 },
						},
					],
				},
			],
		},
		{
			id: "section-2",
			title: "Section 2: Intermediate Topics",
			description: "Functions, loops, and control structures",
			globalTimer: 10, // 10 seconds for testing
			pages: [
				{
					id: "s2-page-1",
					title: "Functions",
					questions: [
						{
							id: "s2-q1",
							type: "choice",
							prompt:
								"Which of the following are valid ways to define a function in JavaScript?",
							options: {
								func: "function myFunc() {}",
								arrow: "const myFunc = () => {}",
								method: "myFunc: function() {}",
								class: "class MyFunc {}",
							},
							correctAnswers: ["func", "arrow", "method"],
						},
						{
							id: "s2-q2",
							type: "long-answer",
							prompt:
								"Explain the difference between function declarations and arrow functions.",
						},
					],
				},
				{
					id: "s2-page-2",
					title: "Loops and Iteration",
					questions: [
						{
							id: "s2-q3",
							type: "ranking",
							prompt:
								"Rank these loop types by their typical performance (fastest to slowest):",
							items: {
								forloop: "for loop",
								foreach: "forEach",
								map: "map",
								reduce: "reduce",
							},
						},
					],
				},
			],
		},
		{
			id: "section-3",
			title: "Section 3: Advanced Concepts",
			description: "Async programming, closures, and design patterns",
			globalTimer: 10, // 10 seconds for testing
			pages: [
				{
					id: "s3-page-1",
					title: "Async Programming",
					questions: [
						{
							id: "s3-q1",
							type: "fill-in-the-blank",
							prompt:
								"To handle asynchronous operations in JavaScript, you can use {{method_one}}, {{method_two}}, or {{method_three}}.",
							correctAnswers: {
								method_one: "callbacks",
								method_two: "promises",
								method_three: "async/await",
							},
						},
						{
							id: "s3-q2",
							type: "article",
							prompt:
								"Write a short explanation of how the JavaScript event loop works.",
						},
					],
				},
				{
					id: "s3-page-2",
					title: "Practical Application",
					questions: [
						{
							id: "s3-q3",
							type: "whiteboard",
							prompt:
								"Draw a diagram showing the architecture of a typical React application with state management:",
						},
						{
							id: "s3-q4",
							type: "single-selection-matrix",
							prompt: "Match each design pattern to its primary use case:",
							rows: {
								singleton: "Singleton",
								factory: "Factory",
								observer: "Observer",
								strategy: "Strategy",
							},
							columns: {
								creation: "Object Creation",
								behavior: "Behavior Variation",
								state: "State Management",
								notification: "Event Notification",
							},
						},
					],
				},
			],
		},
		{
			id: "section-4",
			title: "Section 4: All Question Types",
			description:
				"Comprehensive assessment covering all question types with various scoring methods",
			globalTimer: 600, // 10 minutes
			grading: {
				enabled: true,
				passingScore: 70,
				showScoreToStudent: true,
				showCorrectAnswers: true,
			},
			pages: [
				{
					id: "page-1",
					title: "Multiple Choice and Text Questions",
					questions: [
						{
							id: "q1",
							type: "multiple-choice",
							prompt: "What is the capital of France?",
							options: {
								a: "London",
								b: "Berlin",
								c: "Paris",
								d: "Madrid",
							},
							correctAnswer: "c",
							feedback: "Paris is the capital and largest city of France.",
							scoring: { type: "simple", points: 2 },
						},
						{
							id: "q2",
							type: "short-answer",
							prompt: "What is 2 + 2?",
							correctAnswer: "4",
							scoring: { type: "simple", points: 1 },
						},
						{
							id: "q3",
							type: "long-answer",
							prompt:
								"Describe your favorite programming language and why you like it.",
							scoring: { type: "manual", maxPoints: 5 },
						},
					],
				},
				{
					id: "page-2",
					title: "Advanced Question Types",
					questions: [
						{
							id: "q4",
							type: "article",
							prompt:
								"Write a short article about web development trends in 2025.",
							scoring: { type: "rubric", rubricId: 1, maxPoints: 10 },
						},
						{
							id: "q5",
							type: "fill-in-the-blank",
							prompt:
								"The capital of France is {{capital}} and the largest city is {{largest_city}}.",
							correctAnswers: { capital: "Paris", largest_city: "Paris" },
							scoring: {
								type: "weighted",
								maxPoints: 4,
								mode: "partial-no-penalty",
								pointsPerCorrect: 2,
							},
						},
						{
							id: "q6",
							type: "choice",
							prompt:
								"Which of the following are programming languages? (Select all that apply)",
							options: {
								python: "Python",
								html: "HTML",
								javascript: "JavaScript",
								css: "CSS",
								java: "Java",
							},
							correctAnswers: ["python", "javascript", "java"],
							scoring: {
								type: "weighted",
								maxPoints: 6,
								mode: "partial-with-penalty",
								pointsPerCorrect: 2,
								penaltyPerIncorrect: 1,
							},
						},
					],
				},
				{
					id: "page-3",
					title: "Interactive Questions",
					questions: [
						{
							id: "q7",
							type: "ranking",
							prompt:
								"Rank these programming paradigms from most to least popular:",
							items: {
								oop: "Object-Oriented",
								fp: "Functional",
								procedural: "Procedural",
								logic: "Logic",
							},
							correctOrder: ["oop", "fp", "procedural", "logic"],
							scoring: {
								type: "ranking",
								maxPoints: 4,
								mode: "exact-order",
							},
						},
						{
							id: "q10",
							type: "whiteboard",
							prompt:
								"Draw a diagram showing the relationship between the frontend, backend, and database in a web application:",
							scoring: { type: "rubric", rubricId: 2, maxPoints: 8 },
						},
						{
							id: "q8",
							type: "single-selection-matrix",
							prompt: "Rate your experience with these technologies:",
							rows: {
								react: "React",
								vue: "Vue",
								angular: "Angular",
								svelte: "Svelte",
							},
							columns: {
								beginner: "Beginner",
								intermediate: "Intermediate",
								advanced: "Advanced",
								expert: "Expert",
							},
							scoring: {
								type: "matrix",
								maxPoints: 4,
								pointsPerRow: 1,
								mode: "partial",
							},
						},
						{
							id: "324okp",
							type: "multiple-selection-matrix",
							prompt: "Select your preferred framework for each use case:",
							rows: {
								simple: "Building a simple website",
								spa: "Creating a complex SPA",
								mobile: "Developing a mobile app",
							},
							columns: {
								react: "React",
								vue: "Vue",
								angular: "Angular",
								svelte: "Svelte",
								nextjs: "Next.js",
							},
							scoring: {
								type: "matrix",
								maxPoints: 3,
								pointsPerRow: 1,
								mode: "partial",
							},
						},
					],
				},
				{
					id: "page-4",
					title: "日本語読解テスト - Japanese Reading Comprehension",
					questions: [
						{
							id: "jp-q1",
							type: "multiple-choice",
							prompt: "犯人が被害者に残すものは何か？",
							options: {
								a: "青い折り紙の船",
								b: "赤い折り紙の鶴",
								c: "白い和紙の短冊",
								d: "黒い金属の指輪",
							},
							correctAnswer: "b",
						},
						{
							id: "jp-q2",
							type: "multiple-choice",
							prompt: "犯行が行われる時間帯の特徴は？",
							options: {
								a: "早朝のラッシュ時",
								b: "満月の深夜帯",
								c: "雨の夕暮れ時",
								d: "平日の昼下がり",
							},
							correctAnswer: "b",
						},
						{
							id: "jp-q3",
							type: "multiple-choice",
							prompt: "被害者に共通する職業は？",
							options: {
								a: "飲食店経営者",
								b: "元孤児院職員",
								c: "IT技術者",
								d: "公務員",
							},
							correctAnswer: "b",
						},
						{
							id: "jp-q4",
							type: "multiple-choice",
							prompt: "警察が注目する文学作品は？",
							options: {
								a: "「罪と炎」",
								b: "「月と影」",
								c: "「孤児の祈り」",
								d: "「仮面の告白」",
							},
							correctAnswer: "a",
						},
						{
							id: "jp-q5",
							type: "multiple-choice",
							prompt: "精神鑑定で「認められない」とされたのは？",
							options: {
								a: "計画性",
								b: "理性的思考",
								c: "反社会性パーソナリティ障害",
								d: "トラウマ反応",
							},
							correctAnswer: "c",
						},
						{
							id: "jp-q6",
							type: "multiple-choice",
							prompt: "犯人が現場で意図的に行っていた行動は？",
							options: {
								a: "照明を消す",
								b: "靴音を響かせる",
								c: "窓を破壊する",
								d: "被害者を縛る",
							},
							correctAnswer: "b",
						},
						{
							id: "jp-q7",
							type: "multiple-choice",
							prompt: "事件のキーワード「悔い改め」が確認された場所は？",
							options: {
								a: "被害者の携帯",
								b: "玄関に貼られた和紙",
								c: "SNSのプロフィール",
								d: "犯行声明文の末尾",
							},
							correctAnswer: "b",
						},
						{
							id: "jp-q8",
							type: "multiple-choice",
							prompt: "監視カメラに映らない犯人の特徴は？",
							options: {
								a: "左利きである",
								b: "能面のような仮面",
								c: "足のサイズ",
								d: "声の高さ",
							},
							correctAnswer: "a",
							feedback:
								"監視カメラには「能面のような無表情の仮面」を被った姿が映っています。左利きかどうかは記事に記載されていません。",
						},
						{
							id: "jp-q9",
							type: "multiple-choice",
							prompt: "捜査の矛盾点として正しいのは？",
							options: {
								a: "孤児院は10年前に閉鎖",
								b: "被害者は全員50代",
								c: "折鶴と施設の関連不明",
								d: "金属ワイヤーの材質不一致",
							},
							correctAnswer: "c",
							feedback:
								"記事によると、孤児院「暁光園」は20年前に閉鎖され、関係者の証言からは「折鶴」との関連性は見出せていません。",
						},
						{
							id: "jp-q10",
							type: "multiple-choice",
							prompt: "犯人がSNSで使用する暗号の元ネタは？",
							options: {
								a: "2020年代の流行歌",
								b: "インターネットスラング",
								c: "絶版書籍の引用",
								d: "映画の台詞",
							},
							correctAnswer: "c",
							feedback:
								"警察は「文学作品『罪と炎』（1923年絶版）の引用パターン」を手掛かりに捜査を進めています。",
						},
					],
				},
			],
		},
	],
};

// Alias for backward compatibility
export const sampleQuizConfig: QuizConfig = sampleNestedQuizConfig;

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
				rawQuizConfig: sampleNestedQuizConfig,
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
				rawQuizConfig: sampleNestedQuizConfig,
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
