import { href, useFetcher } from "react-router";
import type { clientAction } from "~/routes/course.$id.grades";
import { ContentType } from "~/utils/get-content-type";

export function useCreateGradeItem() {
	const fetcher = useFetcher<typeof clientAction>();

	const createGradeItem = (
		courseId: number,
		values: {
			name: string;
			description?: string;
			categoryId?: number | null;
			maxGrade?: number;
			minGrade?: number;
			weight?: number | null;
			extraCredit?: boolean;
		},
	) => {
		const submissionData = {
			intent: "create-item" as const,
			...values,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
			action: href("/course/:courseId/grades", {
				courseId: courseId.toString(),
			}),
		});
	};

	return {
		createGradeItem,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateCategory() {
	const fetcher = useFetcher<typeof clientAction>();

	const createCategory = (values: {
		name: string;
		description?: string;
		parentId?: number | null;
		weight?: number | null;
	}) => {
		const submissionData = {
			intent: "create-category" as const,
			...values,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
		});
	};

	return {
		createCategory,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useUpdateGradeItem() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateGradeItem = (
		courseId: number,
		itemId: number,
		values: {
			name?: string;
			description?: string;
			categoryId?: number | null;
			maxGrade?: number;
			minGrade?: number;
			weight?: number | null;
			extraCredit?: boolean;
		},
	) => {
		const submissionData = {
			intent: "update-item" as const,
			itemId,
			...values,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
			action: href("/course/:courseId/grades", {
				courseId: courseId.toString(),
			}),
		});
	};

	return {
		updateGradeItem,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useUpdateGradeCategory() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateGradeCategory = async (
		categoryId: number,
		values: {
			name?: string;
			description?: string;
			weight?: number | null;
		},
	) => {
		const submissionData = {
			intent: "update-category" as const,
			categoryId,
			...values,
		};
		await fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
		});
	};

	return {
		updateGradeCategory,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useDeleteManualItem() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteManualItem = (courseId: number, itemId: number) => {
		const submissionData = {
			intent: "delete-item" as const,
			itemId,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
			action: href("/course/:courseId/grades", {
				courseId: courseId.toString(),
			}),
		});
	};

	return {
		deleteManualItem,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useDeleteCategory() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteCategory = (courseId: number, categoryId: number) => {
		const submissionData = {
			intent: "delete-category" as const,
			categoryId,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
			action: href("/course/:courseId/grades", {
				courseId: courseId.toString(),
			}),
		});
	};

	return {
		deleteCategory,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}
