import { notifications } from "@mantine/notifications";
import { useQueryState } from "nuqs";
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
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
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
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

export const gradesSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(gradesSearchParams);

// ============================================================================
// Schemas
// ============================================================================

const createItemSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	categoryId: z.coerce.number().optional().nullable(),
	maxGrade: z.coerce.number().optional(),
	minGrade: z.coerce.number().optional(),
	weight: z.coerce.number().nullable(),
	extraCredit: z.boolean().optional(),
});

const createCategorySchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	parentId: z.coerce.number().optional().nullable(),
	extraCredit: z.boolean().optional(),
});

const updateItemSchema = z.object({
	itemId: z.coerce.number(),
	name: z.string().min(1, "Name is required").optional(),
	description: z.string().optional(),
	categoryId: z.coerce.number().optional().nullable(),
	maxGrade: z.coerce.number().optional(),
	minGrade: z.coerce.number().optional(),
	weight: z.coerce.number().nullable(),
	extraCredit: z.boolean().optional(),
});

const updateCategorySchema = z.object({
	categoryId: z.coerce.number(),
	name: z.string().min(1, "Name is required").optional(),
	description: z.string().optional(),
	weight: z.coerce.number().nullable(),
	extraCredit: z.boolean().optional(),
});

const getItemSchema = z.object({
	itemId: z.coerce.number(),
});

const getCategorySchema = z.object({
	categoryId: z.coerce.number(),
});

const deleteItemSchema = z.object({
	itemId: z.coerce.number(),
});

const deleteCategorySchema = z.object({
	categoryId: z.coerce.number(),
});

// ============================================================================
// Loader
// ============================================================================

export const loader = async ({ context }: Route.LoaderArgs) => {
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
	};
};

// ============================================================================
// Action Handlers
// ============================================================================

async function createItemAction({ request, context }: Route.ActionArgs) {
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

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = createItemSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	// Get next sort order
	const sortOrderResult = await tryGetNextItemSortOrder({
		payload,
		gradebookId: gradebook.id,
		categoryId: parsedData.data.categoryId ?? null,
		req: payloadRequest,
	});

	if (!sortOrderResult.ok) {
		return badRequest({ error: "Failed to get sort order" });
	}

	const createResult = await tryCreateGradebookItem({
		payload,
		courseId: courseContext.course.id,
		categoryId: parsedData.data.categoryId ?? null,
		name: parsedData.data.name,
		description: parsedData.data.description,
		maxGrade: parsedData.data.maxGrade,
		minGrade: parsedData.data.minGrade,
		weight: parsedData.data.weight,
		extraCredit: parsedData.data.extraCredit ?? false,
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
}

async function createCategoryAction({ request, context }: Route.ActionArgs) {
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

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = createCategorySchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	// Get next sort order
	const sortOrderResult = await tryGetNextSortOrder({
		payload,
		gradebookId: gradebook.id,
		parentId: parsedData.data.parentId ?? null,
		req: payloadRequest,
	});

	if (!sortOrderResult.ok) {
		return badRequest({ error: "Failed to get sort order" });
	}

	const createResult = await tryCreateGradebookCategory({
		payload,
		gradebookId: gradebook.id,
		parentId: parsedData.data.parentId ?? null,
		name: parsedData.data.name,
		description: parsedData.data.description,
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
}

async function updateItemAction({ request, context }: Route.ActionArgs) {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = updateItemSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const updateResult = await tryUpdateGradebookItem({
		payload,
		itemId: parsedData.data.itemId,
		name: parsedData.data.name,
		description: parsedData.data.description,
		categoryId: parsedData.data.categoryId ?? null,
		maxGrade: parsedData.data.maxGrade,
		minGrade: parsedData.data.minGrade,
		weight: parsedData.data.weight,
		extraCredit: parsedData.data.extraCredit,
		req: payloadRequest,
	});

	if (!updateResult.ok) {
		return badRequest({ error: updateResult.error.message });
	}

	return ok({
		success: true,
		message: "Gradebook item updated successfully",
	});
}

async function updateCategoryAction({ request, context }: Route.ActionArgs) {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = updateCategorySchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const updateResult = await tryUpdateGradebookCategory({
		payload,
		categoryId: parsedData.data.categoryId,
		name: parsedData.data.name,
		description: parsedData.data.description,
		weight: parsedData.data.weight,
		extraCredit: parsedData.data.extraCredit,
		req: payloadRequest,
	});

	if (!updateResult.ok) {
		return badRequest({ error: updateResult.error.message });
	}

	return ok({
		success: true,
		message: "Gradebook category updated successfully",
	});
}

async function getItemAction({ request, context }: Route.ActionArgs) {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = getItemSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const itemResult = await tryFindGradebookItemById({
		payload,
		itemId: parsedData.data.itemId,
		req: payloadRequest,
	});

	if (!itemResult.ok) {
		return badRequest({ error: itemResult.error.message });
	}

	const item = itemResult.value;

	// Handle category as number or object
	const categoryId =
		typeof item.category === "number"
			? item.category
			: (item.category?.id ?? null);

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
}

async function getCategoryAction({ request, context }: Route.ActionArgs) {
	const { payload } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = getCategorySchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const categoryResult = await tryFindGradebookCategoryById(
		payload,
		parsedData.data.categoryId,
	);

	if (!categoryResult.ok) {
		return badRequest({ error: categoryResult.error.message });
	}

	const category = categoryResult.value;

	// Handle parent as number or object
	const parentId =
		typeof category.parent === "number"
			? category.parent
			: (category.parent?.id ?? null);

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
}

async function deleteItemAction({ request, context }: Route.ActionArgs) {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = deleteItemSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const deleteResult = await tryDeleteGradebookItem({
		payload,
		itemId: parsedData.data.itemId,
		req: payloadRequest,
	});

	if (!deleteResult.ok) {
		return badRequest({ error: deleteResult.error.message });
	}

	return ok({
		success: true,
		message: "Gradebook item deleted successfully",
	});
}

async function deleteCategoryAction({ request, context }: Route.ActionArgs) {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = deleteCategorySchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	const deleteResult = await tryDeleteGradebookCategory({
		payload,
		categoryId: parsedData.data.categoryId,
		req: payloadRequest,
	});

	if (!deleteResult.ok) {
		return badRequest({ error: deleteResult.error.message });
	}

	return ok({
		success: true,
		message: "Gradebook category deleted successfully",
	});
}

export const action = async (args: Route.ActionArgs) => {
	const { request, context } = args;
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!userSession?.isAuthenticated) {
		return badRequest({ error: "Unauthorized" });
	}

	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			error: "Action is required",
		});
	}

	switch (actionType) {
		case Action.CreateItem:
			return createItemAction(args);
		case Action.CreateCategory:
			return createCategoryAction(args);
		case Action.UpdateItem:
			return updateItemAction(args);
		case Action.UpdateCategory:
			return updateCategoryAction(args);
		case Action.DeleteItem:
			return deleteItemAction(args);
		case Action.DeleteCategory:
			return deleteCategoryAction(args);
		case Action.GetItem:
			return getItemAction(args);
		case Action.GetCategory:
			return getCategoryAction(args);
		default:
			return badRequest({ error: "Invalid action" });
	}
};

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
	const [activeTab] = useQueryState("tab", {
		defaultValue: "report",
	});

	return (
		<>
			{activeTab === "setup" ? (
				<GradebookSetupView
					data={loaderData}
				/>
			) : (
				<GraderReportView data={loaderData} />
			)}
		</>
	);
}
