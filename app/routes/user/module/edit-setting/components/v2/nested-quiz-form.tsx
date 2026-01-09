import { Button, NumberInput, Paper, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateNestedQuizInfo,
	useUpdateNestedQuizTimer,
} from "app/routes/user/module/edit-setting/route";
import { PagesList } from "./pages-list";
import { ResourcesList } from "./resources-list";
import type { NestedQuizConfig, QuizConfig } from "./types";

interface NestedQuizFormProps {
	moduleId: number;
	nestedQuiz: NestedQuizConfig;
	nestedQuizIndex: number;
}

export function NestedQuizForm({
	moduleId,
	nestedQuiz,
	nestedQuizIndex,
}: NestedQuizFormProps) {
	const { submit: updateNestedQuizInfo, isLoading: isUpdatingInfo } =
		useUpdateNestedQuizInfo();
	const { submit: updateNestedQuizTimer, isLoading: isUpdatingTimer } =
		useUpdateNestedQuizTimer();

	// We need to get the full quiz config to pass to PagesList and ResourcesList
	// For now, we'll create a temporary regular config structure
	const tempQuizConfig: QuizConfig = {
		version: "v2",
		type: "regular",
		id: nestedQuiz.id,
		title: nestedQuiz.title,
		pages: nestedQuiz.pages,
		resources: nestedQuiz.resources,
		globalTimer: nestedQuiz.globalTimer,
	};

	const infoForm = useForm({
		initialValues: {
			title: nestedQuiz.title,
			description: nestedQuiz.description || "",
		},
	});

	const timerForm = useForm({
		initialValues: {
			seconds: nestedQuiz.globalTimer ?? undefined,
		},
	});

	return (
		<Stack gap="md">
			<Paper withBorder p="md" radius="md">
				<form
					onSubmit={infoForm.onSubmit((values) => {
						updateNestedQuizInfo({
							params: { moduleId },
							values: {
								nestedQuizId: nestedQuiz.id,
								updates: {
									title: values.title,
									description: values.description,
								},
							},
						});
					})}
				>
					<Stack gap="md">
						<Title order={5}>Quiz Information</Title>
						<TextInput
							{...infoForm.getInputProps("title")}
							label="Quiz Title"
							required
						/>
						<Textarea
							{...infoForm.getInputProps("description")}
							label="Description"
							minRows={2}
						/>
						<Button type="submit" loading={isUpdatingInfo}>
							Save Quiz Information
						</Button>
					</Stack>
				</form>
			</Paper>

			<Paper withBorder p="md" radius="md">
				<form
					onSubmit={timerForm.onSubmit((values) => {
						updateNestedQuizTimer({
							params: { moduleId },
							values: {
								nestedQuizId: nestedQuiz.id,
								seconds: values.seconds ?? undefined,
							},
						});
					})}
				>
					<Stack gap="md">
						<Title order={5}>Time Limit</Title>
						<NumberInput
							{...timerForm.getInputProps("seconds")}
							label="Time Limit (seconds)"
							min={0}
						/>
						<Button type="submit" loading={isUpdatingTimer}>
							Save Time Limit
						</Button>
					</Stack>
				</form>
			</Paper>

			<ResourcesList
				moduleId={moduleId}
				quizConfig={tempQuizConfig}
				nestedQuizId={nestedQuiz.id}
			/>

			<PagesList
				moduleId={moduleId}
				quizConfig={tempQuizConfig}
				nestedQuizId={nestedQuiz.id}
			/>
		</Stack>
	);
}
