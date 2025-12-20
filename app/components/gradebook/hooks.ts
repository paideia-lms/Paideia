import { stringify } from "qs";
import { href, useFetcher } from "react-router";
import type { clientAction } from "~/routes/course.$id.grades";
import { ContentType } from "~/utils/get-content-type";

enum Action {
	CreateItem = "create-item",
	CreateCategory = "create-category",
	UpdateItem = "update-item",
	UpdateCategory = "update-category",
	DeleteItem = "delete-item",
	DeleteCategory = "delete-category",
	GetItem = "get-item",
	GetCategory = "get-category",
}

const getRouteUrl = (action: Action, courseId: number) => {
	return (
		href("/course/:courseId/grades", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
};

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
		fetcher.submit(values, {
			method: "POST",
			encType: ContentType.JSON,
			action: getRouteUrl(Action.CreateItem, courseId),
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

	const createCategory = (
		courseId: number,
		values: {
			name: string;
			description?: string;
			parentId?: number | null;
			weight?: number | null;
		},
	) => {
		fetcher.submit(values, {
			method: "POST",
			encType: ContentType.JSON,
			action: getRouteUrl(Action.CreateCategory, courseId),
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
			itemId,
			...values,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
			action: getRouteUrl(Action.UpdateItem, courseId),
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

	const updateGradeCategory = (
		courseId: number,
		categoryId: number,
		values: {
			name?: string;
			description?: string;
			weight?: number | null;
			extraCredit?: boolean;
		},
	) => {
		const submissionData = {
			categoryId,
			...values,
		};
		fetcher.submit(submissionData, {
			method: "POST",
			encType: ContentType.JSON,
			action: getRouteUrl(Action.UpdateCategory, courseId),
		});
	};

	return {
		updateGradeCategory,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useDeleteGradeItem() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteGradeItem = (courseId: number, itemId: number) => {
		fetcher.submit(
			{ itemId },
			{
				method: "POST",
				encType: ContentType.JSON,
				action: getRouteUrl(Action.DeleteItem, courseId),
			},
		);
	};

	return {
		deleteGradeItem,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useDeleteGradeCategory() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteGradeCategory = (courseId: number, categoryId: number) => {
		fetcher.submit(
			{ categoryId },
			{
				method: "POST",
				encType: ContentType.JSON,
				action: getRouteUrl(Action.DeleteCategory, courseId),
			},
		);
	};

	return {
		deleteGradeCategory,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}
