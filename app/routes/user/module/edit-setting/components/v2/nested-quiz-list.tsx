import { Button, Checkbox, Group, Paper, Stack, Tabs, Title } from "@mantine/core";
import { useState } from "react";
import { useForm } from "@mantine/form";
import {
	useUpdateContainerSettings,
} from "app/routes/user/module/edit-setting/route";
import type { QuizConfig } from "./types";
import { NestedQuizForm } from "./nested-quiz-form";
import { AddNestedQuizForm } from "./add-nested-quiz-form";
import { RemoveNestedQuizButton } from "./remove-nested-quiz-button";

interface NestedQuizListProps {
	moduleId: number;
	quizConfig: QuizConfig;
}

export function NestedQuizList({
	moduleId,
	quizConfig,
}: NestedQuizListProps) {
	const { submit: updateContainerSettings, isLoading: isUpdatingSettings } =
		useUpdateContainerSettings();

	// All hooks must be called before any early returns
	const nestedQuizzes =
		quizConfig.type === "container" ? quizConfig.nestedQuizzes : [];

	// Set active tab to the last quiz (newly added quizzes appear at the end)
	const lastQuizId =
		nestedQuizzes.length > 0
			? nestedQuizzes[nestedQuizzes.length - 1]!.id
			: null;
	const [activeTab, setActiveTab] = useState<string | null>(lastQuizId);

	const settingsForm = useForm({
		initialValues: {
			sequentialOrder:
				quizConfig.type === "container"
					? quizConfig.sequentialOrder ?? false
					: false,
		},
	});

	if (quizConfig.type !== "container") {
		return null;
	}

	return (
		<Stack gap="md">
			<Title order={4}>Nested Quizzes</Title>

			<AddNestedQuizForm moduleId={moduleId} />

			{/* Container Settings */}
			<Paper withBorder p="md" radius="md">
				<form
					onSubmit={settingsForm.onSubmit((values) => {
						updateContainerSettings({
							params: { moduleId },
							values: {
								settings: { sequentialOrder: values.sequentialOrder },
							},
						});
					})}
				>
					<Stack gap="md">
						<Checkbox
							{...settingsForm.getInputProps("sequentialOrder", {
								type: "checkbox",
							})}
							label="Sequential Order (Quizzes must be completed in order)"
						/>
						<Button type="submit" loading={isUpdatingSettings}>
							Save Container Settings
						</Button>
					</Stack>
				</form>
			</Paper>

			{nestedQuizzes.length === 0 ? (
				<Paper withBorder p="xl" radius="md">
					<p>No quizzes yet. Add a quiz above.</p>
				</Paper>
			) : (
				<Tabs value={activeTab} onChange={setActiveTab}>
					<Tabs.List>
						{nestedQuizzes.map((quiz) => (
							<Tabs.Tab key={quiz.id} value={quiz.id}>
								{quiz.title || `Quiz ${nestedQuizzes.indexOf(quiz) + 1}`}
							</Tabs.Tab>
						))}
					</Tabs.List>

					{nestedQuizzes.map((quiz) => (
						<Tabs.Panel key={quiz.id} value={quiz.id} pt="md">
							<Stack gap="md">
								<Group justify="space-between">
									<Title order={5}>
										{quiz.title || `Quiz ${nestedQuizzes.indexOf(quiz) + 1}`}
									</Title>
									<RemoveNestedQuizButton
										moduleId={moduleId}
										nestedQuizId={quiz.id}
										disabled={nestedQuizzes.length <= 1}
									/>
								</Group>
								<NestedQuizForm
									moduleId={moduleId}
									nestedQuiz={quiz}
									nestedQuizIndex={nestedQuizzes.indexOf(quiz)}
									parentQuizConfig={quizConfig}
								/>
							</Stack>
						</Tabs.Panel>
					))}
				</Tabs>
			)}
		</Stack>
	);
}
