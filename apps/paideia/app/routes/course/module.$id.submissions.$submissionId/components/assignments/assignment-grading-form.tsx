import { Button, Group, NumberInput, Paper, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { FormableSimpleRichTextEditor } from "app/components/form-components/formable-simple-rich-text-editor";
import {
	useGradeSubmission,
	useReleaseGrade,
	useRemoveGrade,
} from "app/routes/course/module.$id.submissions/route";
import { useFormWithSyncedInitialValues } from "app/utils/ui/form-utils";
import type { AssignmentGradingViewProps } from "./assignment-grading-view";

// ============================================================================
// Types
// ============================================================================

interface GradingFormValues {
	score: number | string;
	feedback: string;
}

type AssignmentGradingFormProps = {
	loaderData: AssignmentGradingViewProps;
};

// ============================================================================
// Component
// ============================================================================

export function AssignmentGradingForm({
	loaderData,
}: AssignmentGradingFormProps) {
	const { submit: gradeSubmission, isLoading: isGrading } =
		useGradeSubmission();

	const submission = loaderData.gradingSubmission;
	const submissionId = submission.id;
	const moduleLinkId = loaderData.moduleLinkId;
	const grade = loaderData.gradingGrade;
	const maxGrade = loaderData.maxGrade;
	const enrollment = submission.enrollment;
	const courseModuleLink = submission.courseModuleLink;

	const initialFormValues = {
		score: grade?.baseGrade ?? "",
		feedback: grade?.feedback ?? "",
	};
	const form = useForm<GradingFormValues>({
		mode: "uncontrolled",
		initialValues: initialFormValues,
	});
	useFormWithSyncedInitialValues(form, initialFormValues);

	return (
		<Paper withBorder shadow="sm" p="md" radius="md">
			<form
				onSubmit={form.onSubmit((values) => {
					const scoreValue =
						typeof values.score === "number"
							? values.score
							: Number.parseFloat(String(values.score));
					if (Number.isNaN(scoreValue)) {
						notifications.show({
							title: "Error",
							message: "Invalid score value",
							color: "red",
						});
						return;
					}

					gradeSubmission({
						params: { moduleLinkId },
						values: {
							submissionId,
							score: scoreValue,
							feedback: values.feedback || undefined,
						},
					});
				})}
			>
				<Stack gap="md">
					<Title order={4}>Grade Submission</Title>

					<NumberInput
						label="Score"
						placeholder="Enter score"
						min={0}
						max={maxGrade ?? 100}
						key={form.key("score")}
						description={`Maximum score is ${maxGrade}`}
						{...form.getInputProps("score")}
					/>

					<FormableSimpleRichTextEditor
						form={form}
						formKey="feedback"
						key={form.key("feedback")}
						label="Feedback"
						placeholder="Provide feedback for the student..."
					/>

					<Group justify="flex-end">
						<Button type="submit" variant="filled" loading={isGrading}>
							Submit Grade
						</Button>
						{submission.status === "graded" &&
							grade?.baseGrade !== null &&
							grade?.baseGrade !== undefined && (
								<RemoveGradeButton
									submissionId={submissionId}
									moduleLinkId={moduleLinkId}
								/>
							)}
						{grade?.baseGrade !== null &&
							grade?.baseGrade !== undefined &&
							submission.status === "graded" &&
							enrollment !== null &&
							enrollment !== undefined &&
							courseModuleLink !== null &&
							courseModuleLink !== undefined && (
								<ReleaseGradeButton
									enrollment={enrollment}
									courseModuleLink={courseModuleLink}
									moduleLinkId={moduleLinkId}
								/>
							)}
					</Group>
				</Stack>
			</form>
		</Paper>
	);
}

// ============================================================================
// Remove Grade Button Component
// ============================================================================

interface RemoveGradeButtonProps {
	submissionId: number;
	moduleLinkId: number;
}

function RemoveGradeButton({
	submissionId,
	moduleLinkId,
}: RemoveGradeButtonProps) {
	const { submit: removeGrade, isLoading: isRemovingGrade } = useRemoveGrade();

	return (
		<Button
			variant="outline"
			color="red"
			loading={isRemovingGrade}
			onClick={async () => {
				if (
					!window.confirm(
						"Are you sure you want to unset the grade? This action cannot be undone.",
					)
				)
					return;
				await removeGrade({
					params: {
						moduleLinkId,
					},
					values: {
						submissionId,
					},
				});
			}}
		>
			Unset Grade
		</Button>
	);
}

// ============================================================================
// Release Grade Button Component
// ============================================================================

interface ReleaseGradeButtonProps {
	enrollment?: AssignmentGradingViewProps["gradingSubmission"]["enrollment"];
	courseModuleLink?: AssignmentGradingViewProps["gradingSubmission"]["courseModuleLink"];
	moduleLinkId: number;
}

function ReleaseGradeButton({
	enrollment,
	courseModuleLink,
	moduleLinkId,
}: ReleaseGradeButtonProps) {
	const { submit: releaseGrade, isLoading: isReleasing } = useReleaseGrade();

	return (
		<Button
			variant="outline"
			loading={isReleasing}
			onClick={async () => {
				if (!enrollment || !courseModuleLink) return;
				const enrollmentId = enrollment.id;
				const courseModuleLinkId = courseModuleLink.id;
				await releaseGrade({
					params: {
						moduleLinkId,
					},
					values: {
						courseModuleLinkId,
						enrollmentId,
					},
				});
			}}
		>
			Release Grade
		</Button>
	);
}
