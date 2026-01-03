import { notifications } from "@mantine/notifications";
import {
	parseAsStringEnum,
} from "nuqs";
import { stringify } from "qs";
import { href } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { createActionMap, typeCreateActionRpc } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { serverOnly$ } from "vite-env-only/macros";
import {
	tryCreateGradebookCategory,
	tryDeleteGradebookCategory,
	tryFindGradebookCategoryById,
	tryGetNextSortOrder,
	tryUpdateGradebookCategory,
} from "server/internal/gradebook-category-management";
import {
	tryCreateGradebookItem,
	tryDeleteGradebookItem,
	tryFindGradebookItemById,
	tryGetNextItemSortOrder,
	tryUpdateGradebookItem,
} from "server/internal/gradebook-item-management";
import { tryGetGradebookByCourseWithDetails } from "server/internal/gradebook-management";
import { tryGetUserGradesJsonRepresentation } from "server/internal/user-grade-management";
import { z } from "zod";
import { GraderReportView } from "~/components/gradebook/report-view";
import { GradebookSetupView } from "~/components/gradebook/setup-view";
import { badRequest, ForbiddenResponse, ok } from "~/utils/responses";
import type { Route } from "./+types/course.$id.grades";

export type { Route };

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

export const loaderSearchParams = {
	tab: parseAsStringEnum(["report", "setup"]).withDefault("report"),
};

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createCreateItemActionRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().min(1, "Name is required"),
		description: z.string().optional(),
		categoryId: z.coerce.number().optional().nullable(),
		maxGrade: z.coerce.number().optional(),
		minGrade: z.coerce.number().optional(),
		weight: z.coerce.number().nullable(),
		extraCredit: z.boolean().optional(),
	}),
	method: "POST",
	action: Action.CreateItem,
});

const createCreateCategoryActionRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().min(1, "Name is required"),
		description: z.string().optional(),
		parentId: z.coerce.number().optional().nullable(),
		extraCredit: z.boolean().optional(),
	}),
	method: "POST",
	action: Action.CreateCategory,
});

const createUpdateItemActionRpc = createActionRpc({
	formDataSchema: z.object({
		itemId: z.coerce.number(),
		name: z.string().min(1, "Name is required").optional(),
		description: z.string().optional(),
		categoryId: z.coerce.number().optional().nullable(),
		maxGrade: z.coerce.number().optional(),
		minGrade: z.coerce.number().optional(),
		weight: z.coerce.number().nullable(),
		extraCredit: z.boolean().optional(),
	}),
	method: "POST",
	action: Action.UpdateItem,
});

const createUpdateCategoryActionRpc = createActionRpc({
	formDataSchema: z.object({
		categoryId: z.coerce.number(),
		name: z.string().min(1, "Name is required").optional(),
		description: z.string().optional(),
		weight: z.coerce.number().nullable(),
		extraCredit: z.boolean().optional(),
	}),
	method: "POST",
	action: Action.UpdateCategory,
});

const createGetItemActionRpc = createActionRpc({
	formDataSchema: z.object({
		itemId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.GetItem,
});

const createGetCategoryActionRpc = createActionRpc({
	formDataSchema: z.object({
		categoryId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.GetCategory,
});

const createDeleteItemActionRpc = createActionRpc({
	formDataSchema: z.object({
		itemId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteItem,
});

const createDeleteCategoryActionRpc = createActionRpc({
	formDataSchema: z.object({
		categoryId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteCategory,
});

export function getRouteUrl(action: Action, courseId: number) {
	return (
		href("/course/:courseId/grades", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
}

// ============================================================================
// Loader
// ============================================================================

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, searchParams, params }) => {
	const courseContext = context.get(courseContextKey);
	const { payload, payloadRequest } = context.get(globalContextKey);

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const gradebookSetupForUI = courseContext.gradebookSetupForUI;

	// Fetch user grades for the course

	const userGrades = await tryGetUserGradesJsonRepresentation({
		payload,
		req: payloadRequest,
		courseId: courseContext.course.id,
	}).getOrNull();

	return {
		course: courseContext.course,
		gradebook: courseContext.gradebook,
		gradebookJson: courseContext.gradebookJson,
		gradebookYaml: courseContext.gradebookYaml,
		gradebookMarkdown: courseContext.gradebookMarkdown,
		gradebookSetupForUI,
		flattenedCategories: courseContext.flattenedCategories,
		enrollments: courseContext.course.enrollments.filter(
			(e) => e.status === "active" && e.role === "student",
		),
		hasExtraCredit: gradebookSetupForUI
			? gradebookSetupForUI.totals.calculatedTotal > 100 ||
			gradebookSetupForUI.extraCreditItems.length > 0 ||
			gradebookSetupForUI.extraCreditCategories.length > 0
			: false,
		displayTotal: gradebookSetupForUI?.totals.calculatedTotal ?? 0,
		extraCreditItems: gradebookSetupForUI?.extraCreditItems ?? [],
		extraCreditCategories: gradebookSetupForUI?.extraCreditCategories ?? [],
		totalMaxGrade: gradebookSetupForUI?.totals.totalMaxGrade ?? 0,
		userGrades,
		searchParams,
		params,
	};
});

const [createItemAction, useCreateItem] = createCreateItemActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const courseContext = context.get(courseContextKey);
		if (!courseContext)
			throw new ForbiddenResponse("Course not found or access denied");

		// Get gradebook
		const gradebookResult = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: courseContext.course.id,
			req: payloadRequest,
		});
		if (!gradebookResult.ok)
			return badRequest({ error: "Gradebook not found for this course" });
		const gradebook = gradebookResult.value;

		// Get next sort order
		const sortOrderResult = await tryGetNextItemSortOrder({
			payload,
			gradebookId: gradebook.id,
			categoryId: formData.categoryId ?? null,
			req: payloadRequest,
		});

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const createResult = await tryCreateGradebookItem({
			payload,
			courseId: courseContext.course.id,
			categoryId: formData.categoryId ?? null,
			name: formData.name,
			description: formData.description,
			maxGrade: formData.maxGrade,
			minGrade: formData.minGrade,
			weight: formData.weight,
			extraCredit: formData.extraCredit ?? false,
			sortOrder: sortOrderResult.value,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook item created successfully",
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [createCategoryAction, useCreateCategory] = createCreateCategoryActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const courseContext = context.get(courseContextKey);
		if (!courseContext)
			throw new ForbiddenResponse("Course not found or access denied");

		// Get gradebook
		const gradebookResult = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: courseContext.course.id,
			req: payloadRequest,
		});
		if (!gradebookResult.ok)
			return badRequest({ error: "Gradebook not found for this course" });
		const gradebook = gradebookResult.value;

		// Get next sort order
		const sortOrderResult = await tryGetNextSortOrder({
			payload,
			gradebookId: gradebook.id,
			parentId: formData.parentId ?? null,
			req: payloadRequest,
		});

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const createResult = await tryCreateGradebookCategory({
			payload,
			gradebookId: gradebook.id,
			parentId: formData.parentId ?? null,
			name: formData.name,
			description: formData.description,
			sortOrder: sortOrderResult.value,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}
		return ok({
			success: true,
			message: "Gradebook category created successfully",
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [updateItemAction, useUpdateItem] = createUpdateItemActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const updateResult = await tryUpdateGradebookItem({
			payload,
			itemId: formData.itemId,
			name: formData.name,
			description: formData.description,
			categoryId: formData.categoryId ?? null,
			maxGrade: formData.maxGrade,
			minGrade: formData.minGrade,
			weight: formData.weight,
			extraCredit: formData.extraCredit,
			req: payloadRequest,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook item updated successfully",
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [updateCategoryAction, useUpdateCategory] = createUpdateCategoryActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const updateResult = await tryUpdateGradebookCategory({
			payload,
			categoryId: formData.categoryId,
			name: formData.name,
			description: formData.description,
			weight: formData.weight,
			extraCredit: formData.extraCredit,
			req: payloadRequest,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook category updated successfully",
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [getItemAction, useGetItem] = createGetItemActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const itemResult = await tryFindGradebookItemById({
			payload,
			itemId: formData.itemId,
			req: payloadRequest,
		});

		if (!itemResult.ok) {
			return badRequest({ error: itemResult.error.message });
		}

		const item = itemResult.value;

		// Handle category as number or object
		const categoryId =
			item.category
			?? null;

		return ok({
			success: true,
			item: {
				id: item.id,
				name: item.name,
				description: item.description ?? "",
				categoryId,
				maxGrade: item.maxGrade,
				minGrade: item.minGrade,
				weight: item.weight,
				extraCredit: item.extraCredit ?? false,
			},
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [getCategoryAction, useGetCategory] = createGetCategoryActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const categoryResult = await tryFindGradebookCategoryById({
			payload,
			categoryId: formData.categoryId,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!categoryResult.ok) {
			return badRequest({ error: categoryResult.error.message });
		}

		const category = categoryResult.value;

		// Handle parent as number or object
		const parentId = category.parent?.id ?? null;

		return ok({
			success: true,
			category: {
				id: category.id,
				name: category.name,
				description: category.description ?? "",
				parentId,
				weight: category.weight,
			},
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [deleteItemAction, useDeleteItem] = createDeleteItemActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const deleteResult = await tryDeleteGradebookItem({
			payload,
			itemId: formData.itemId,
			req: payloadRequest,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook item deleted successfully",
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [deleteCategoryAction, useDeleteCategory] = createDeleteCategoryActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const deleteResult = await tryDeleteGradebookCategory({
			payload,
			categoryId: formData.categoryId,
			req: payloadRequest,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook category deleted successfully",
		});
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

// Export hooks for use in components
export {
	useCreateItem,
	useCreateCategory,
	useUpdateItem,
	useUpdateCategory,
	useGetItem,
	useGetCategory,
	useDeleteItem,
	useDeleteCategory,
};



const [action] = createActionMap({
	[Action.CreateItem]: createItemAction,
	[Action.CreateCategory]: createCategoryAction,
	[Action.UpdateItem]: updateItemAction,
	[Action.UpdateCategory]: updateCategoryAction,
	[Action.DeleteItem]: deleteItemAction,
	[Action.DeleteCategory]: deleteCategoryAction,
	[Action.GetItem]: getItemAction,
	[Action.GetCategory]: getCategoryAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData && "success" in actionData && actionData.success) {
		if ("message" in actionData) {
			notifications.show({
				title: "Success",
				message: actionData.message,
				color: "green",
			});
		}
	} else if (actionData && "error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

export default function CourseGradesPage({ loaderData }: Route.ComponentProps) {
	const { searchParams } = loaderData;

	return (
		<>
			{searchParams.tab === "setup" ? (
				<GradebookSetupView data={loaderData} />
			) : (
				<GraderReportView data={loaderData} />
			)}
		</>
	);
}
