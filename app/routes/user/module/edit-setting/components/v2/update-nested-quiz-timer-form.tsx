import { Button, NumberInput, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateNestedQuizTimer,
} from "app/routes/user/module/edit-setting/route";
import type { NestedQuizConfig } from "./types";

interface UpdateNestedQuizTimerFormProps {
	moduleId: number;
	nestedQuiz: NestedQuizConfig;
}

export function UpdateNestedQuizTimerForm({
	moduleId,
	nestedQuiz,
}: UpdateNestedQuizTimerFormProps) {
	const { submit: updateNestedQuizTimer, isLoading: isUpdatingTimer } =
		useUpdateNestedQuizTimer();

	const form = useForm({
		initialValues: {
			seconds: nestedQuiz.globalTimer ?? undefined,
		},
	});

	return (
		<form
				onSubmit={form.onSubmit((values) => {
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
						{...form.getInputProps("seconds")}
						label="Time Limit (seconds)"
						min={0}
					/>
					<Button type="submit" loading={isUpdatingTimer}>
						Save Time Limit
					</Button>
				</Stack>
			</form>
	);
}
