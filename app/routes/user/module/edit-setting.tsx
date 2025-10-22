import { Container, Paper, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { href, useFetcher, useLoaderData } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	tryUpdateActivityModule,
	type UpdateActivityModuleArgs,
} from "server/internal/activity-module-management";
import {
	AssignmentForm as TanstackAssignmentForm,
	DiscussionForm as TanstackDiscussionForm,
	PageForm as TanstackPageForm,
	QuizForm as TanstackQuizForm,
	WhiteboardForm as TanstackWhiteboardForm,
	useAppForm,
} from "~/components/activity-module-forms-v2";
import type { QuizConfig } from "~/components/activity-modules-preview/quiz-config.types";
import {
	type ActivityModuleFormValues,
	activityModuleSchema,
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import {
	badRequest,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit-setting";
import type { UpdateModuleFormApi } from "~/hooks/use-form-context";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userModuleContext = context.get(userModuleContextKey);

	if (!userModuleContext) {
		throw new NotFoundResponse("Module context not found");
	}

	return {
		module: userModuleContext.module,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to edit modules",
		});
	}

	const moduleId = params.moduleId;
	if (!moduleId) {
		return badRequest({
			success: false,
			error: "Module ID is required",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = activityModuleSchema.parse(data);

	const { pageData, whiteboardData, assignmentData, quizData, discussionData } =
		transformToActivityData(parsedData);

	// Build args based on module type (discriminated union)
	const baseArgs = {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		requirePassword: parsedData.requirePassword,
		accessPassword: parsedData.accessPassword,
	};

	let updateArgs: UpdateActivityModuleArgs;
	if (parsedData.type === "page" && pageData) {
		updateArgs = { ...baseArgs, type: "page" as const, pageData };
	} else if (parsedData.type === "whiteboard" && whiteboardData) {
		updateArgs = { ...baseArgs, type: "whiteboard" as const, whiteboardData };
	} else if (parsedData.type === "assignment" && assignmentData) {
		updateArgs = { ...baseArgs, type: "assignment" as const, assignmentData };
	} else if (parsedData.type === "quiz" && quizData) {
		updateArgs = { ...baseArgs, type: "quiz" as const, quizData };
	} else if (parsedData.type === "discussion" && discussionData) {
		updateArgs = { ...baseArgs, type: "discussion" as const, discussionData };
	} else {
		return badRequest({
			success: false,
			error: `Invalid module type or missing data for ${parsedData.type}`,
		});
	}

	const updateResult = await tryUpdateActivityModule(payload, updateArgs);

	if (!updateResult.ok) {
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	return ok({
		success: true,
		message: "Module updated successfully",
	});
};

export const clientAction = async ({
	serverAction,
}: Route.ClientActionArgs) => {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData?.message,
			color: "green",
		});
	}

	return actionData;
};

// Custom hook for updating module
export function useUpdateModule() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateModule = (moduleId: string, values: ActivityModuleFormValues) => {
		const submissionData = transformFormValues(values);
		fetcher.submit(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			submissionData as any,
			{
				method: "POST",
				action: href("/user/module/edit/:moduleId/setting", {
					moduleId,
				}),
				encType: ContentType.JSON,
			});
	};

	return {
		updateModule,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}


export default function EditModulePage() {
	const { module } = useLoaderData<typeof loader>();
	const { updateModule, isLoading } = useUpdateModule();

	// Extract activity-specific data
	const pageData = module.page;
	const whiteboardData = module.whiteboard;
	const assignmentData = module.assignment;
	const quizData = module.quiz;
	const discussionData = module.discussion;

	// Tanstack Form (new)
	const updateModuleForm = useAppForm({
		defaultValues: {
			title: module.title,
			description: module.description || "",
			type: module.type,
			status: module.status,
			requirePassword: module.requirePassword || false,
			accessPassword: module.accessPassword || "",
			// Page fields
			pageContent: pageData?.content || "",
			// Whiteboard fields
			whiteboardContent: whiteboardData?.content || "",
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
			quizGradingType: quizData?.gradingType || "automatic",
			rawQuizConfig: quizData?.rawQuizConfig
				? (quizData.rawQuizConfig as QuizConfig)
				: null,
			// Discussion fields
			discussionInstructions: discussionData?.instructions || "",
			discussionDueDate: discussionData?.dueDate
				? new Date(discussionData.dueDate)
				: null,
			discussionRequireThread: discussionData?.requireThread || false,
			discussionRequireReplies: discussionData?.requireReplies || false,
			discussionMinReplies: discussionData?.minReplies || 1,
		},
		onSubmitMeta: {
			type: module.type,
			id: module.id,
		},
		onSubmit: ({ value }) => {
			console.log("onSubmit", value);
			updateModule(String(module.id), value);
		},
		// ! make sure our type of FormApi is correct
	}) satisfies UpdateModuleFormApi;


	const selectedType = updateModuleForm.state.values.type;

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

			<Stack gap="xl">

				{/* Edit Form */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="lg">
						Edit Activity Module
					</Title>
					<updateModuleForm.AppForm>
						<form onSubmit={async (e) => {

							e.preventDefault();
							e.stopPropagation();
							await updateModuleForm.handleSubmit()
						}}>
							<Stack gap="md">
								<updateModuleForm.AppField name="type">
									{(field) => {
										return (
											<field.SelectField
												label="Module Type"
												placeholder="Select module type"
												disabled
												data={[
													{ value: "page", label: "Page" },
													{ value: "whiteboard", label: "Whiteboard" },
													{ value: "assignment", label: "Assignment" },
													{ value: "quiz", label: "Quiz" },
													{ value: "discussion", label: "Discussion" },
												]}
											/>
										);
									}}
								</updateModuleForm.AppField>

								{selectedType === "page" && (
									<TanstackPageForm form={updateModuleForm} />
								)}
								{selectedType === "whiteboard" && (
									<TanstackWhiteboardForm
										form={updateModuleForm}
										isLoading={isLoading}
									/>
								)}
								{selectedType === "assignment" && (
									<TanstackAssignmentForm form={updateModuleForm} />
								)}
								{selectedType === "discussion" && (
									<TanstackDiscussionForm form={updateModuleForm} />
								)}
								{selectedType === "quiz" && <TanstackQuizForm form={updateModuleForm} />}

								<updateModuleForm.SubmitButton
									label="Update Module"
									loadingLabel="Updating..."
									isLoading={isLoading}
								/>
							</Stack>
						</form>
					</updateModuleForm.AppForm>
				</Paper>
			</Stack>
		</Container>
	);
}
