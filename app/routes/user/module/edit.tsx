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
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	redirect,
	useFetcher,
	useLoaderData,
} from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import {
	tryGetActivityModuleById,
	tryUpdateActivityModule,
} from "server/internal/activity-module-management";
import { canManageActivityModules } from "server/utils/permissions";
import {
	type ActivityModuleFormValues,
	activityModuleSchema,
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
	badRequest,
	NotFoundResponse,
	UnauthorizedResponse,
} from "~/utils/responses";
import type { Route } from "./+types/edit";

export const loader = async ({
	context,
	request,
	params,
}: LoaderFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;

	const { user } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user) {
		throw new UnauthorizedResponse("You must be logged in to edit modules");
	}

	if (!canManageActivityModules(user)) {
		throw new UnauthorizedResponse("You don't have permission to edit modules");
	}

	const moduleId = params.id;
	if (!moduleId) {
		throw new NotFoundResponse("Module ID is required");
	}

	const moduleResult = await tryGetActivityModuleById(payload, {
		id: Number(moduleId),
	});

	if (!moduleResult.ok) {
		throw new NotFoundResponse("Activity module not found");
	}

	const module = moduleResult.value;

	// Verify user owns this module
	if (module.createdBy.id !== user.id && user.role !== "admin") {
		throw new UnauthorizedResponse(
			"You don't have permission to edit this module",
		);
	}

	return {
		user,
		module,
	};
};

export const action = async ({
	request,
	context,
	params,
}: ActionFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;

	const { user } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user) {
		return badRequest({
			success: false,
			error: "You must be logged in to edit modules",
		});
	}

	if (!canManageActivityModules(user)) {
		return badRequest({
			success: false,
			error: "You don't have permission to edit modules",
		});
	}

	const moduleId = params.id;
	if (!moduleId) {
		return badRequest({
			success: false,
			error: "Module ID is required",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsedData = activityModuleSchema.parse(data);

	const { assignmentData, quizData, discussionData } =
		transformToActivityData(parsedData);

	const updateResult = await tryUpdateActivityModule(payload, {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		assignmentData,
		quizData,
		discussionData,
		requirePassword: parsedData.requirePassword,
		accessPassword: parsedData.accessPassword,
	});

	if (!updateResult.ok) {
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	throw redirect("/user/profile");
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success !== false) {
		notifications.show({
			title: "Success",
			message: "Activity module updated successfully",
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

export default function EditModulePage() {
	const { module } = useLoaderData<typeof loader>();
	const fetcher = useFetcher<typeof action>();

	// Extract activity-specific data
	const getAssignmentData = () => {
		if (module.type === "assignment" && typeof module.assignment === "object") {
			return module.assignment;
		}
		return null;
	};

	const getQuizData = () => {
		if (module.type === "quiz" && typeof module.quiz === "object") {
			return module.quiz;
		}
		return null;
	};

	const getDiscussionData = () => {
		if (module.type === "discussion" && typeof module.discussion === "object") {
			return module.discussion;
		}
		return null;
	};

	const assignmentData = getAssignmentData();
	const quizData = getQuizData();
	const discussionData = getDiscussionData();

	const form = useForm<ActivityModuleFormValues>({
		mode: "uncontrolled",
		initialValues: {
			title: module.title || "",
			description: module.description || "",
			type: module.type,
			status: module.status,
			requirePassword: module.requirePassword || false,
			accessPassword: module.accessPassword || "",
			// Assignment fields
			assignmentInstructions: assignmentData?.instructions || "",
			assignmentDueDate: assignmentData?.dueDate
				? new Date(assignmentData.dueDate)
				: null,
			assignmentMaxAttempts: assignmentData?.maxAttempts || 1,
			assignmentAllowLateSubmissions:
				assignmentData?.allowLateSubmissions || false,
			assignmentRequireTextSubmission:
				assignmentData?.requireTextSubmission || false,
			assignmentRequireFileSubmission:
				assignmentData?.requireFileSubmission || false,
			// Quiz fields
			quizInstructions: quizData?.instructions || "",
			quizDueDate: quizData?.dueDate ? new Date(quizData.dueDate) : null,
			quizMaxAttempts: quizData?.maxAttempts || 1,
			quizPoints: quizData?.points || 100,
			quizTimeLimit: quizData?.timeLimit || 60,
			quizGradingType:
				(quizData?.gradingType as "automatic" | "manual") || "automatic",
			// Discussion fields
			discussionInstructions: discussionData?.instructions || "",
			discussionDueDate: discussionData?.dueDate
				? new Date(discussionData.dueDate)
				: null,
			discussionRequireThread: discussionData?.requireThread || false,
			discussionRequireReplies: discussionData?.requireReplies || false,
			discussionMinReplies: discussionData?.minReplies || 1,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	const selectedType = form.getValues().type;

	return (
		<Container size="md" py="xl">
			<title>Edit Activity Module | Paideia LMS</title>
			<meta
				name="description"
				content="Edit an activity module in Paideia LMS"
			/>
			<meta property="og:title" content="Edit Activity Module | Paideia LMS" />
			<meta
				property="og:description"
				content="Edit an activity module in Paideia LMS"
			/>

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="lg">
					Edit Activity Module
				</Title>

				<fetcher.Form
					method="POST"
					onSubmit={form.onSubmit((values) => {
						const submissionData = transformFormValues(values);
						fetcher.submit(submissionData, {
							method: "POST",
							encType: "application/json",
						});
					})}
				>
					<Stack gap="md">
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
							disabled
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
							Update Module
						</Button>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
