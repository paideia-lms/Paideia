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
} from "react-router";
import {
	activityModuleSchema,
	getInitialFormValues,
	transformFormValues,
	transformToActivityData,
	type ActivityModuleFormValues,
} from "~/utils/activity-module-schema";
import { globalContextKey } from "server/contexts/global-context";
import { tryCreateActivityModule } from "server/internal/activity-module-management";
import { canManageActivityModules } from "server/utils/permissions";
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

	if (!canManageActivityModules(user)) {
		throw new UnauthorizedResponse(
			"You don't have permission to create modules",
		);
	}

	return {
		user,
	};
};

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

	if (!canManageActivityModules(user)) {
		return badRequest({
			success: false,
			error: "You don't have permission to create modules",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsedData = activityModuleSchema.parse(data);

	const { assignmentData, quizData, discussionData } = transformToActivityData(parsedData);

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

	throw redirect("/user/profile");
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

	const form = useForm<ActivityModuleFormValues>({
		mode: "uncontrolled",
		initialValues: getInitialFormValues(),
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
							Create Module
						</Button>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
