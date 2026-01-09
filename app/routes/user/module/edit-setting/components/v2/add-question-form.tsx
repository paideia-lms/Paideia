import { Button, Select, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useAddQuestion,
} from "app/routes/user/module/edit-setting/route";

interface AddQuestionFormProps {
	moduleId: number;
	pageId: string;
	nestedQuizId?: string;
}

export function AddQuestionForm({
	moduleId,
	pageId,
	nestedQuizId,
}: AddQuestionFormProps) {
	const { submit: addQuestion, isLoading } = useAddQuestion();

	const form = useForm({
		initialValues: {
			type: "multiple-choice" as const,
		},
	});

	const handleSubmit = (values: typeof form.values) => {
		addQuestion({
			params: { moduleId },
			values: {
				pageId,
				questionType: values.type,
				nestedQuizId,
			},
		});
		form.reset();
	};

	return (
		<form onSubmit={form.onSubmit(handleSubmit)}>
			<Stack gap="md">
				<Title order={5}>Add Question</Title>
				<Select
					{...form.getInputProps("type")}
					label="Question Type"
					data={[
						{ value: "multiple-choice", label: "Multiple Choice" },
						{ value: "choice", label: "Choice (Multiple Selection)" },
						{ value: "short-answer", label: "Short Answer" },
						{ value: "long-answer", label: "Long Answer" },
						{ value: "article", label: "Article" },
						{ value: "fill-in-the-blank", label: "Fill in the Blank" },
						{ value: "ranking", label: "Ranking" },
						{
							value: "single-selection-matrix",
							label: "Single Selection Matrix",
						},
						{
							value: "multiple-selection-matrix",
							label: "Multiple Selection Matrix",
						},
						{ value: "whiteboard", label: "Whiteboard" },
					]}
				/>
				<Button type="submit" loading={isLoading}>
					Add Question
				</Button>
			</Stack>
		</form>
	);
}
