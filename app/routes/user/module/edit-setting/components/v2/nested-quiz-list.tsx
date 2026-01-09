import {
	Button,
	Checkbox,
	Group,
	Paper,
	Stack,
	Tabs,
	Title,
} from "@mantine/core";
import { useState } from "react";
import { useForm } from "@mantine/form";
import { useUpdateContainerSettings } from "app/routes/user/module/edit-setting/route";
import type { ContainerQuizConfig } from "./types";
import { NestedQuizForm } from "./nested-quiz-form";
import { AddNestedQuizButton } from "./add-nested-quiz-form";
import { RemoveNestedQuizButton } from "./remove-nested-quiz-button";
import { useFormWithSyncedInitialValues } from "app/utils/form-utils";

interface ContainerSettingsFormProps {
	moduleId: number;
	quizConfig: ContainerQuizConfig;
}

interface NestedQuizListProps {
	moduleId: number;
	quizConfig: ContainerQuizConfig;
}

function ContainerSettingsForm({
	moduleId,
	quizConfig,
}: ContainerSettingsFormProps) {
	const { submit: updateContainerSettings, isLoading: isUpdatingSettings } =
		useUpdateContainerSettings();
	const initialValues = {
		sequentialOrder: quizConfig.sequentialOrder ?? false,
	};
	const form = useForm({
		initialValues,
	});

	useFormWithSyncedInitialValues(form, initialValues);

	return (
		<form
			onSubmit={form.onSubmit(async (values) => {
				await updateContainerSettings({
					params: { moduleId },
					values: { settings: { sequentialOrder: values.sequentialOrder } },
				});
			})}
		>
			<Stack gap="md">
				<Checkbox
					{...form.getInputProps("sequentialOrder", { type: "checkbox" })}
					label="Sequential Order (Quizzes must be completed in order)"
				/>

				<Button type="submit" loading={isUpdatingSettings} disabled={!form.isDirty()}>
					Save Container Settings
				</Button>
			</Stack>
		</form>
	);
}

export function NestedQuizList({ moduleId, quizConfig }: NestedQuizListProps) {
	// All hooks must be called before any early returns
	const nestedQuizzes =
		quizConfig.type === "container" ? quizConfig.nestedQuizzes : [];

	// Set active tab to the last quiz (newly added quizzes appear at the end)
	const lastQuizId =
		nestedQuizzes.length > 0
			? nestedQuizzes[nestedQuizzes.length - 1]!.id
			: null;
	const [activeTab, setActiveTab] = useState<string | null>(lastQuizId);

	if (quizConfig.type !== "container") {
		return null;
	}

	return (
		<Stack gap="md">
			<Title order={4}>
				Nested Quizzes <AddNestedQuizButton moduleId={moduleId} />
			</Title>
			{/* Container Settings */}
			<ContainerSettingsForm moduleId={moduleId} quizConfig={quizConfig} />

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
