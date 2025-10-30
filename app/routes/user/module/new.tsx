import { Button, Container, Paper, Select, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
	type ActionFunctionArgs,
	href,
	type LoaderFunctionArgs,
	redirect,
	useFetcher,
} from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "server/internal/activity-module-management";
import {
	AssignmentForm,
	DiscussionForm,
	PageForm,
	QuizForm,
	WhiteboardForm,
} from "~/components/activity-module-forms";
import {
	type ActivityModuleFormValues,
	activityModuleSchema,
	getInitialFormValues,
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import { badRequest, UnauthorizedResponse } from "~/utils/responses";
import type { Route } from "./+types/new";

export const loader = async ({ context }: LoaderFunctionArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new UnauthorizedResponse("You must be logged in to create modules");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	return {
		user: currentUser,
	};
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsedData = activityModuleSchema.parse(data);

	const { pageData, whiteboardData, assignmentData, quizData, discussionData } =
		transformToActivityData(parsedData);

	// Build args based on module type (discriminated union)
	const baseArgs = {
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status || ("draft" as const),
		userId: currentUser.id,
	};

	let createArgs: CreateActivityModuleArgs;
	if (parsedData.type === "page" && pageData) {
		createArgs = { ...baseArgs, type: "page" as const, pageData };
	} else if (parsedData.type === "whiteboard" && whiteboardData) {
		createArgs = { ...baseArgs, type: "whiteboard" as const, whiteboardData };
	} else if (parsedData.type === "assignment" && assignmentData) {
		createArgs = { ...baseArgs, type: "assignment" as const, assignmentData };
	} else if (parsedData.type === "quiz" && quizData) {
		createArgs = { ...baseArgs, type: "quiz" as const, quizData };
	} else if (parsedData.type === "discussion" && discussionData) {
		createArgs = { ...baseArgs, type: "discussion" as const, discussionData };
	} else {
		return badRequest({
			success: false,
			error: `Invalid module type or missing data for ${parsedData.type}`,
		});
	}

	const createResult = await tryCreateActivityModule(payload, createArgs);

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

// Custom hook for creating module
export function useCreateModule() {
	const fetcher = useFetcher<typeof clientAction>();

	const createModule = (values: ActivityModuleFormValues) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: href("/user/module/new"),
			encType: ContentType.JSON,
		});
	};

	return {
		createModule,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export default function NewModulePage() {
	const { createModule, isLoading } = useCreateModule();

	const form = useForm<
		ActivityModuleFormValues,
		(values: ActivityModuleFormValues) => ActivityModuleFormValues
	>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: getInitialFormValues(),
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	const selectedType = useFormWatchForceUpdate(form, "type");

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

				<form
					onSubmit={form.onSubmit((values) => {
						createModule(values);
					})}
				>
					<Stack gap="md">
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

						{selectedType === "page" && <PageForm form={form} />}
						{selectedType === "whiteboard" && <WhiteboardForm form={form} />}
						{selectedType === "assignment" && <AssignmentForm form={form} />}
						{selectedType === "quiz" && <QuizForm form={form} />}
						{selectedType === "discussion" && <DiscussionForm form={form} />}

						<Button type="submit" size="lg" mt="lg" loading={isLoading}>
							Create Module
						</Button>
					</Stack>
				</form>
			</Paper>
		</Container>
	);
}
