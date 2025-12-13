import { useFetcher, href } from "react-router";
import { type clientAction, Action } from "./route";
import { stringify } from "qs";

const getActionUrl = (action: Action, moduleLinkId: number) => {
	return (
		href("/course/module/:moduleLinkId/submissions", {
			moduleLinkId: moduleLinkId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
};

// ============================================================================
// Hooks
// ============================================================================

export const useDeleteSubmission = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteSubmission = (submissionId: number, moduleLinkId: number) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());

		fetcher.submit(formData, {
			method: "POST",
			action: getActionUrl(Action.DeleteSubmission, moduleLinkId),
		});
	};

	return {
		deleteSubmission,
		isDeleting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useGradeSubmission = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const gradeSubmission = (
		submissionId: number,
		score: number,
		feedback?: string,
	) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		formData.append("score", score.toString());
		if (feedback) {
			formData.append("feedback", feedback);
		}

		fetcher.submit(formData, {
			method: "POST",
			action: getActionUrl(Action.GradeSubmission, moduleLinkId),
		});
	};

	return {
		gradeSubmission,
		isGrading: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useReleaseGrade = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const releaseGrade = (courseModuleLinkId: number, enrollmentId: number) => {
		const formData = new FormData();
		formData.append("courseModuleLinkId", String(courseModuleLinkId));
		formData.append("enrollmentId", String(enrollmentId));
		fetcher.submit(formData, {
			method: "POST",
			action: getActionUrl(Action.ReleaseGrade, moduleLinkId),
		});
	};

	return {
		releaseGrade,
		isReleasing: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};
