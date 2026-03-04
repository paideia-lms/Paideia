import { notifications } from "@mantine/notifications";
import { parseAsStringEnum } from "nuqs";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import {
	createActionMap,
	typeCreateActionRpc,
} from "app/utils/router/action-utils";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { z } from "zod";
import { GraderReportView } from "app/routes/course.$id.grades/report-view";
import { GradebookSetupView } from "app/routes/course.$id.grades/setup-view";
import { badRequest, ForbiddenResponse, ok } from "app/utils/router/responses";
import type { Route } from "./+types/route";

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

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/course/:courseId/grades",
});

const createItemRpc = createActionRpc({
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

const createCategoryRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().min(1, "Name is required"),
		description: z.string().optional(),
		parentId: z.coerce.number().optional().nullable(),
		extraCredit: z.boolean().optional(),
	}),
	method: "POST",
	action: Action.CreateCategory,
});

const updateItemRpc = createActionRpc({
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

const updateCategoryRpc = createActionRpc({
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

const getItemRpc = createActionRpc({
	formDataSchema: z.object({
		itemId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.GetItem,
});

const getCategoryRpc = createActionRpc({
	formDataSchema: z.object({
		categoryId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.GetCategory,
});

const deleteItemRpc = createActionRpc({
	formDataSchema: z.object({
		itemId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteItem,
});

const deleteCategoryRpc = createActionRpc({
	formDataSchema: z.object({
		categoryId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteCategory,
});

// ============================================================================
// Loader
// ============================================================================

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, searchParams, params }) => {
	const courseContext = context.get(courseContextKey);
	const { paideia, requestContext } = context.get(globalContextKey);

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const gradebookSetupForUI = courseContext.gradebookSetupForUI;

	// Fetch user grades for the course

	const userGrades = await paideia
		.tryGetUserGradesJsonRepresentation({
			req: requestContext,
			courseId: courseContext.course.id,
		})
		.getOrNull();

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

const createItemAction = createItemRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);
		const courseContext = context.get(courseContextKey);
		if (!courseContext)
			throw new ForbiddenResponse("Course not found or access denied");

		// Get gradebook
		const gradebookResult = await paideia.tryGetGradebookByCourseWithDetails({
			courseId: courseContext.course.id,
			req: requestContext,
		});
		if (!gradebookResult.ok)
			return badRequest({ error: "Gradebook not found for this course" });
		const gradebook = gradebookResult.value;

		// Get next sort order
		const sortOrderResult = await paideia.tryGetNextItemSortOrder({
			gradebookId: gradebook.id,
			categoryId: formData.categoryId ?? null,
			req: requestContext,
		});

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const createResult = await paideia.tryCreateGradebookItem({
			courseId: courseContext.course.id,
			categoryId: formData.categoryId ?? null,
			name: formData.name,
			description: formData.description,
			maxGrade: formData.maxGrade,
			minGrade: formData.minGrade,
			weight: formData.weight,
			extraCredit: formData.extraCredit ?? false,
			sortOrder: sortOrderResult.value,
			req: requestContext,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook item created successfully",
		});
	})!,
);

const useCreateItem = createItemRpc.createHook<typeof createItemAction>();

const createCategoryAction = createCategoryRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);
		const courseContext = context.get(courseContextKey);
		if (!courseContext)
			throw new ForbiddenResponse("Course not found or access denied");

		// Get gradebook
		const gradebookResult = await paideia.tryGetGradebookByCourseWithDetails({
			courseId: courseContext.course.id,
			req: requestContext,
		});
		if (!gradebookResult.ok)
			return badRequest({ error: "Gradebook not found for this course" });
		const gradebook = gradebookResult.value;

		// Get next sort order
		const sortOrderResult = await paideia.tryGetNextSortOrder({
			gradebookId: gradebook.id,
			parentId: formData.parentId ?? null,
			req: requestContext,
		});

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const createResult = await paideia.tryCreateGradebookCategory({
			gradebookId: gradebook.id,
			parentId: formData.parentId ?? null,
			name: formData.name,
			description: formData.description,
			sortOrder: sortOrderResult.value,
			req: requestContext,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}
		return ok({
			success: true,
			message: "Gradebook category created successfully",
		});
	})!,
);

const useCreateCategory =
	createCategoryRpc.createHook<typeof createCategoryAction>();

const updateItemAction = updateItemRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);

		const updateResult = await paideia.tryUpdateGradebookItem({
			itemId: formData.itemId,
			name: formData.name,
			description: formData.description,
			categoryId: formData.categoryId ?? null,
			maxGrade: formData.maxGrade,
			minGrade: formData.minGrade,
			weight: formData.weight,
			extraCredit: formData.extraCredit,
			req: requestContext,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook item updated successfully",
		});
	})!,
);

const useUpdateItem = updateItemRpc.createHook<typeof updateItemAction>();

const updateCategoryAction = updateCategoryRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);

		const updateResult = await paideia.tryUpdateGradebookCategory({
			categoryId: formData.categoryId,
			name: formData.name,
			description: formData.description,
			weight: formData.weight,
			extraCredit: formData.extraCredit,
			req: requestContext,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook category updated successfully",
		});
	})!,
);

const useUpdateCategory =
	updateCategoryRpc.createHook<typeof updateCategoryAction>();

const getItemAction = getItemRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);

		const itemResult = await paideia.tryFindGradebookItemById({
			itemId: formData.itemId,
			req: requestContext,
		});

		if (!itemResult.ok) {
			return badRequest({ error: itemResult.error.message });
		}

		const item = itemResult.value;

		// Handle category as number or object
		const categoryId = item.category ?? null;

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
);

const useGetItem = getItemRpc.createHook<typeof getItemAction>();

const getCategoryAction = getCategoryRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);

		const categoryResult = await paideia.tryFindGradebookCategoryById({
			categoryId: formData.categoryId,
			req: requestContext,
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
);

const useGetCategory = getCategoryRpc.createHook<typeof getCategoryAction>();

const deleteItemAction = deleteItemRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);

		const deleteResult = await paideia.tryDeleteGradebookItem({
			itemId: formData.itemId,
			req: requestContext,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook item deleted successfully",
		});
	})!,
);

const useDeleteItem = deleteItemRpc.createHook<typeof deleteItemAction>();

const deleteCategoryAction = deleteCategoryRpc.createAction(
	serverOnly$(async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);

		const deleteResult = await paideia.tryDeleteGradebookCategory({
			categoryId: formData.categoryId,
			req: requestContext,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({
			success: true,
			message: "Gradebook category deleted successfully",
		});
	})!,
);

const useDeleteCategory =
	deleteCategoryRpc.createHook<typeof deleteCategoryAction>();

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
	const actionData = (await serverAction()) as
		| { success: true; message?: string }
		| { error: string }
		| undefined;

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
