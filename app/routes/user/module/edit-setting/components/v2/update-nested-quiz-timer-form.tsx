import { Button, NumberInput, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateNestedQuizTimer,
} from "app/routes/user/module/edit-setting/route";
import type { NestedQuizConfig } from "./types";
import { useFormWithSyncedInitialValues } from "app/utils/form-utils";

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

	const initialValues = {
		seconds: nestedQuiz.globalTimer ?? undefined,
	};

	const form = useForm({
		initialValues,
	});

	useFormWithSyncedInitialValues(form, initialValues);
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
				<Button type="submit" loading={isUpdatingTimer} disabled={!form.isDirty()}>
					Save Time Limit
				</Button>
			</Stack>
		</form>
	);
}
