import { Button, NumberInput, Paper, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateGlobalTimer,
} from "app/routes/user/module/edit-setting/route";
import type { QuizConfig } from "./types";

interface GlobalTimerFormProps {
	moduleId: number;
	quizConfig: QuizConfig;
}

export function GlobalTimerForm({
	moduleId,
	quizConfig,
}: GlobalTimerFormProps) {
	const { submit: updateGlobalTimer, isLoading } = useUpdateGlobalTimer();

	const form = useForm({
		initialValues: {
			seconds: quizConfig.globalTimer ?? undefined,
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateGlobalTimer({
					params: { moduleId },
					values: { seconds: values.seconds ?? undefined },
				});
			})}
		>
			<Stack gap="md">
				<Title order={4}>Global Timer</Title>
				<NumberInput
					{...form.getInputProps("seconds")}
					label="Global Timer (seconds)"
					description="Timer for the entire quiz (optional)"
					min={0}
				/>
				<Button type="submit" loading={isLoading}>
					Save Global Timer
				</Button>
			</Stack>
		</form>
	);
}
