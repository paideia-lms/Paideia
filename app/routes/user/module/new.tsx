import {
	Button,
	Checkbox,
	Container,
	NumberInput,
	Paper,
	Select,
	Stack,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { isUndefined, omitBy } from "es-toolkit";
import {
	type ActionFunctionArgs,
	href,
	type LoaderFunctionArgs,
	redirect,
	useFetcher,
} from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryCreateActivityModule } from "server/internal/activity-module-management";
import type { ActivityModule } from "server/payload-types";
import { z } from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, UnauthorizedResponse } from "~/utils/responses";
import type { Route } from "./+types/new";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;

	const { user } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user) {
		throw new UnauthorizedResponse("You must be logged in to create modules");
	}

	// Check if user has permission to create modules
	const canCreateModules =
		user.role === "admin" ||
		user.role === "instructor" ||
		user.role === "content-manager";

	if (!canCreateModules) {
		throw new UnauthorizedResponse(
			"You don't have permission to create modules",
		);
	}

	return {
		user,
	};
};

const createModuleSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	type: z.enum(["page", "whiteboard", "assignment", "quiz", "discussion"]),
	status: z.enum(["draft", "published", "archived"]).optional(),
	requirePassword: z.boolean().optional(),
	accessPassword: z.string().optional(),
	// Assignment fields
	assignmentInstructions: z.string().optional(),
	assignmentDueDate: z.string().optional(),
	assignmentMaxAttempts: z.number().optional(),
	assignmentAllowLateSubmissions: z.boolean().optional(),
	assignmentRequireTextSubmission: z.boolean().optional(),
	assignmentRequireFileSubmission: z.boolean().optional(),
	// Quiz fields
	quizInstructions: z.string().optional(),
	quizDueDate: z.string().optional(),
	quizMaxAttempts: z.number().optional(),
	quizPoints: z.number().optional(),
	quizTimeLimit: z.number().optional(),
	quizGradingType: z.enum(["automatic", "manual"]).optional(),
	// Discussion fields
	discussionInstructions: z.string().optional(),
	discussionDueDate: z.string().optional(),
	discussionRequireThread: z.boolean().optional(),
	discussionRequireReplies: z.boolean().optional(),
	discussionMinReplies: z.number().optional(),
});

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;

	const { user } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	// Check if user has permission to create modules
	const canCreateModules =
		user.role === "admin" ||
		user.role === "instructor" ||
		user.role === "content-manager";

	if (!canCreateModules) {
		return badRequest({
			success: false,
			error: "You don't have permission to create modules",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsedData = createModuleSchema.parse(data);

	// Build activity-specific data based on type
	let assignmentData:
		| {
				instructions?: string;
				dueDate?: string;
				maxAttempts?: number;
				allowLateSubmissions?: boolean;
				requireTextSubmission?: boolean;
				requireFileSubmission?: boolean;
		  }
		| undefined;
	let quizData:
		| {
				instructions?: string;
				dueDate?: string;
				maxAttempts?: number;
				points?: number;
				timeLimit?: number;
				gradingType?: "automatic" | "manual";
		  }
		| undefined;
	let discussionData:
		| {
				instructions?: string;
				dueDate?: string;
				requireThread?: boolean;
				requireReplies?: boolean;
				minReplies?: number;
		  }
		| undefined;

	if (parsedData.type === "assignment") {
		assignmentData = {
			instructions: parsedData.assignmentInstructions,
			dueDate: parsedData.assignmentDueDate,
			maxAttempts: parsedData.assignmentMaxAttempts,
			allowLateSubmissions: parsedData.assignmentAllowLateSubmissions,
			requireTextSubmission: parsedData.assignmentRequireTextSubmission,
			requireFileSubmission: parsedData.assignmentRequireFileSubmission,
		};
	} else if (parsedData.type === "quiz") {
		quizData = {
			instructions: parsedData.quizInstructions,
			dueDate: parsedData.quizDueDate,
			maxAttempts: parsedData.quizMaxAttempts,
			points: parsedData.quizPoints,
			timeLimit: parsedData.quizTimeLimit,
			gradingType: parsedData.quizGradingType,
		};
	} else if (parsedData.type === "discussion") {
		discussionData = {
			instructions: parsedData.discussionInstructions,
			dueDate: parsedData.discussionDueDate,
			requireThread: parsedData.discussionRequireThread,
			requireReplies: parsedData.discussionRequireReplies,
			minReplies: parsedData.discussionMinReplies,
		};
	}

	const createResult = await tryCreateActivityModule(payload, {
		title: parsedData.title,
		description: parsedData.description,
		type: parsedData.type,
		status: parsedData.status || "draft",
		userId: user.id,
		assignmentData,
		quizData,
		discussionData,
		requirePassword: parsedData.requirePassword,
		accessPassword: parsedData.accessPassword,
	});

	if (!createResult.ok) {
		return badRequest({
			success: false,
			error: createResult.error.message,
		});
	}

	throw redirect(href("/user/profile"));
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success !== false) {
		notifications.show({
			title: "Success",
			message: "Activity module created successfully",
			color: "green",
		});
	} else if ("error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

export default function NewModulePage() {
	const fetcher = useFetcher<typeof action>();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			title: "",
			description: "",
			type: "page" as ActivityModule["type"],
			status: "draft" as ActivityModule["status"],
			requirePassword: false,
			accessPassword: "",
			// Assignment fields
			assignmentInstructions: "",
			assignmentDueDate: null as Date | null,
			assignmentMaxAttempts: 1,
			assignmentAllowLateSubmissions: false,
			assignmentRequireTextSubmission: false,
			assignmentRequireFileSubmission: false,
			// Quiz fields
			quizInstructions: "",
			quizDueDate: null as Date | null,
			quizMaxAttempts: 1,
			quizPoints: 100,
			quizTimeLimit: 60,
			quizGradingType: "automatic" as const,
			// Discussion fields
			discussionInstructions: "",
			discussionDueDate: null as Date | null,
			discussionRequireThread: false,
			discussionRequireReplies: false,
			discussionMinReplies: 1,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	const selectedType = form.getValues().type;

	return (
		<Container size="md" py="xl">
			<title>Create Activity Module | Paideia LMS</title>
			<meta
				name="description"
				content="Create a new activity module in Paideia LMS"
			/>
			<meta
				property="og:title"
				content="Create Activity Module | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Create a new activity module in Paideia LMS"
			/>

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="lg">
					Create New Activity Module
				</Title>

				<fetcher.Form
					method="POST"
					onSubmit={form.onSubmit((values) => {
						// Convert dates to ISO strings and filter out undefined values
						const submissionData = omitBy(
							{
								...values,
								assignmentDueDate: values.assignmentDueDate
									? values.assignmentDueDate.toISOString()
									: undefined,
								quizDueDate: values.quizDueDate
									? values.quizDueDate.toISOString()
									: undefined,
								discussionDueDate: values.discussionDueDate
									? values.discussionDueDate.toISOString()
									: undefined,
							},
							isUndefined,
						);

						fetcher.submit(submissionData, {
							method: "POST",
							encType: "application/json",
						});
					})}
				>
					<Stack gap="md">
						{/* Basic Fields */}
						<TextInput
							{...form.getInputProps("title")}
							key={form.key("title")}
							label="Title"
							placeholder="Enter module title"
							required
							withAsterisk
						/>

						<Textarea
							{...form.getInputProps("description")}
							key={form.key("description")}
							label="Description"
							placeholder="Enter module description"
							minRows={3}
						/>

						<Select
							{...form.getInputProps("type")}
							key={form.key("type")}
							label="Module Type"
							placeholder="Select module type"
							required
							withAsterisk
							data={[
								{ value: "page", label: "Page" },
								{ value: "whiteboard", label: "Whiteboard" },
								{ value: "assignment", label: "Assignment" },
								{ value: "quiz", label: "Quiz" },
								{ value: "discussion", label: "Discussion" },
							]}
						/>

						<Select
							{...form.getInputProps("status")}
							key={form.key("status")}
							label="Status"
							placeholder="Select status"
							data={[
								{ value: "draft", label: "Draft" },
								{ value: "published", label: "Published" },
								{ value: "archived", label: "Archived" },
							]}
						/>

						{/* Password Protection */}
						<Checkbox
							{...form.getInputProps("requirePassword", { type: "checkbox" })}
							key={form.key("requirePassword")}
							label="Require password to access"
						/>

						{form.getValues().requirePassword && (
							<TextInput
								{...form.getInputProps("accessPassword")}
								key={form.key("accessPassword")}
								label="Access Password"
								placeholder="Enter access password"
							/>
						)}

						{/* Assignment-specific fields */}
						{selectedType === "assignment" && (
							<>
								<Title order={4} mt="md">
									Assignment Settings
								</Title>
								<Textarea
									{...form.getInputProps("assignmentInstructions")}
									key={form.key("assignmentInstructions")}
									label="Instructions"
									placeholder="Enter assignment instructions"
									minRows={3}
								/>
								<DateTimePicker
									{...form.getInputProps("assignmentDueDate")}
									key={form.key("assignmentDueDate")}
									label="Due Date"
									placeholder="Select due date"
								/>
								<NumberInput
									{...form.getInputProps("assignmentMaxAttempts")}
									key={form.key("assignmentMaxAttempts")}
									label="Max Attempts"
									placeholder="Enter max attempts"
									min={1}
								/>
								<Checkbox
									{...form.getInputProps("assignmentAllowLateSubmissions", {
										type: "checkbox",
									})}
									key={form.key("assignmentAllowLateSubmissions")}
									label="Allow late submissions"
								/>
								<Checkbox
									{...form.getInputProps("assignmentRequireTextSubmission", {
										type: "checkbox",
									})}
									key={form.key("assignmentRequireTextSubmission")}
									label="Require text submission"
								/>
								<Checkbox
									{...form.getInputProps("assignmentRequireFileSubmission", {
										type: "checkbox",
									})}
									key={form.key("assignmentRequireFileSubmission")}
									label="Require file submission"
								/>
							</>
						)}

						{/* Quiz-specific fields */}
						{selectedType === "quiz" && (
							<>
								<Title order={4} mt="md">
									Quiz Settings
								</Title>
								<Textarea
									{...form.getInputProps("quizInstructions")}
									key={form.key("quizInstructions")}
									label="Instructions"
									placeholder="Enter quiz instructions"
									minRows={3}
								/>
								<DateTimePicker
									{...form.getInputProps("quizDueDate")}
									key={form.key("quizDueDate")}
									label="Due Date"
									placeholder="Select due date"
								/>
								<NumberInput
									{...form.getInputProps("quizMaxAttempts")}
									key={form.key("quizMaxAttempts")}
									label="Max Attempts"
									placeholder="Enter max attempts"
									min={1}
								/>
								<NumberInput
									{...form.getInputProps("quizPoints")}
									key={form.key("quizPoints")}
									label="Total Points"
									placeholder="Enter total points"
									min={0}
								/>
								<NumberInput
									{...form.getInputProps("quizTimeLimit")}
									key={form.key("quizTimeLimit")}
									label="Time Limit (minutes)"
									placeholder="Enter time limit in minutes"
									min={1}
								/>
								<Select
									{...form.getInputProps("quizGradingType")}
									key={form.key("quizGradingType")}
									label="Grading Type"
									data={[
										{ value: "automatic", label: "Automatic" },
										{ value: "manual", label: "Manual" },
									]}
								/>
							</>
						)}

						{/* Discussion-specific fields */}
						{selectedType === "discussion" && (
							<>
								<Title order={4} mt="md">
									Discussion Settings
								</Title>
								<Textarea
									{...form.getInputProps("discussionInstructions")}
									key={form.key("discussionInstructions")}
									label="Instructions"
									placeholder="Enter discussion instructions"
									minRows={3}
								/>
								<DateTimePicker
									{...form.getInputProps("discussionDueDate")}
									key={form.key("discussionDueDate")}
									label="Due Date"
									placeholder="Select due date"
								/>
								<Checkbox
									{...form.getInputProps("discussionRequireThread", {
										type: "checkbox",
									})}
									key={form.key("discussionRequireThread")}
									label="Require thread creation"
								/>
								<Checkbox
									{...form.getInputProps("discussionRequireReplies", {
										type: "checkbox",
									})}
									key={form.key("discussionRequireReplies")}
									label="Require replies"
								/>
								{form.getValues().discussionRequireReplies && (
									<NumberInput
										{...form.getInputProps("discussionMinReplies")}
										key={form.key("discussionMinReplies")}
										label="Minimum Replies"
										placeholder="Enter minimum number of replies"
										min={1}
									/>
								)}
							</>
						)}

						<Button
							type="submit"
							size="lg"
							mt="lg"
							loading={fetcher.state === "submitting"}
						>
							Create Module
						</Button>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
