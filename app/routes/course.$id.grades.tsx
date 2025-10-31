import { notifications } from "@mantine/notifications";
import { useQueryState } from "nuqs";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateGradebookCategory,
	tryFindGradebookCategoryById,
	tryGetNextSortOrder,
	tryUpdateGradebookCategory,
} from "server/internal/gradebook-category-management";
import {
	tryCreateGradebookItem,
	tryFindGradebookItemById,
	tryGetNextItemSortOrder,
	tryUpdateGradebookItem,
} from "server/internal/gradebook-item-management";
import { tryFindGradebookByCourseId } from "server/internal/gradebook-management";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, BadRequestResponse, ForbiddenResponse, ok } from "~/utils/responses";
import type { Route } from "./+types/course.$id.grades";
import { inputSchema } from "~/components/gradebook/schemas";
import { GraderReportView } from "~/components/gradebook/report-view";
import { GradebookSetupView } from "~/components/gradebook/setup-view";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const courseContext = context.get(courseContextKey);

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new BadRequestResponse("Invalid course ID");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}


	const gradebookSetupForUI = courseContext.gradebookSetupForUI;

	return {
		course: courseContext.course,
		gradebook: courseContext.gradebook,
		gradebookJson: courseContext.gradebookJson,
		gradebookYaml: courseContext.gradebookYaml,
		gradebookSetupForUI,
		flattenedCategories: courseContext.flattenedCategories,
		enrollments: courseContext.course.enrollments.filter(
			(e) => e.status === "active",
		),
		hasExtraCredit: gradebookSetupForUI ? (gradebookSetupForUI.totals.calculatedTotal > 100 || gradebookSetupForUI.extraCreditItems.length > 0) : false,
		displayTotal: gradebookSetupForUI?.totals.calculatedTotal ?? 0,
		extraCreditItems: gradebookSetupForUI?.extraCreditItems ?? [],
		totalMaxGrade: gradebookSetupForUI?.totals.totalMaxGrade ?? 0,
	}
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({ error: "Unauthorized" });
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({ error: "Invalid course ID" });
	}

	// Get gradebook for this course
	const gradebookResult = await tryFindGradebookByCourseId(payload, courseId);
	if (!gradebookResult.ok) {
		return badRequest({ error: "Gradebook not found for this course" });
	}

	const gradebook = gradebookResult.value;
	const gradebookId = gradebook.id;

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = inputSchema.safeParse(data);

	if (!parsedData.success) {
		return badRequest({ error: parsedData.error.message });
	}

	if (parsedData.data.intent === "create-item") {
		// Get next sort order
		const sortOrderResult = await tryGetNextItemSortOrder(
			payload,
			gradebookId,
			parsedData.data.categoryId ?? null,
		);

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const sortOrder = sortOrderResult.value;

		// Create gradebook item
		const createResult = await tryCreateGradebookItem(
			payload,
			request,
			{
				gradebookId,
				categoryId: parsedData.data.categoryId ?? null,
				name: parsedData.data.name,
				description: parsedData.data.description,
				maxGrade: parsedData.data.maxGrade,
				minGrade: parsedData.data.minGrade,
				weight: parsedData.data.weight,
				extraCredit: parsedData.data.extraCredit ?? false,
				sortOrder,
			},
		);

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return ok({ success: true, message: "Gradebook item created successfully" });
	}

	if (parsedData.data.intent === "create-category") {
		// Get next sort order
		const sortOrderResult = await tryGetNextSortOrder(
			payload,
			gradebookId,
			parsedData.data.parentId ?? null,
		);

		if (!sortOrderResult.ok) {
			return badRequest({ error: "Failed to get sort order" });
		}

		const sortOrder = sortOrderResult.value;

		// Create gradebook category
		const createResult = await tryCreateGradebookCategory(
			payload,
			request,
			{
				gradebookId,
				parentId: parsedData.data.parentId ?? null,
				name: parsedData.data.name,
				description: parsedData.data.description,
				weight: parsedData.data.weight,
				sortOrder,
			},
		);


		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}
		return ok({ success: true, message: "Gradebook category created successfully" });
	}

	if (parsedData.data.intent === "update-item") {
		const updateResult = await tryUpdateGradebookItem(
			payload,
			request,
			parsedData.data.itemId,
			{
				name: parsedData.data.name,
				description: parsedData.data.description,
				maxGrade: parsedData.data.maxGrade,
				minGrade: parsedData.data.minGrade,
				weight: parsedData.data.weight,
				extraCredit: parsedData.data.extraCredit,
			},
		);

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({ success: true, message: "Gradebook item updated successfully" });
	}

	if (parsedData.data.intent === "update-category") {
		const updateResult = await tryUpdateGradebookCategory(
			payload,
			request,
			parsedData.data.categoryId,
			{
				name: parsedData.data.name,
				description: parsedData.data.description,
				weight: parsedData.data.weight,
			},
		);

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({ success: true, message: "Gradebook category updated successfully" });
	}

	if (parsedData.data.intent === "get-item") {
		const itemResult = await tryFindGradebookItemById(
			payload,
			parsedData.data.itemId,
		);

		if (!itemResult.ok) {
			return badRequest({ error: itemResult.error.message });
		}

		const item = itemResult.value;

		// Handle category as number or object
		const categoryId = typeof item.category === "number"
			? item.category
			: item.category?.id ?? null;

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

	if (parsedData.data.intent === "get-category") {
		const categoryResult = await tryFindGradebookCategoryById(
			payload,
			parsedData.data.categoryId,
		);

		if (!categoryResult.ok) {
			return badRequest({ error: categoryResult.error.message });
		}

		const category = categoryResult.value;

		// Handle parent as number or object
		const parentId = typeof category.parent === "number"
			? category.parent
			: category.parent?.id ?? null;

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

	return badRequest({ error: "Invalid intent" });
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
	const { hasExtraCredit, displayTotal, extraCreditItems, totalMaxGrade } = loaderData;
	const [activeTab] = useQueryState("tab", {
		defaultValue: "report",
	});

	return (
		<>
			{activeTab === "setup" ? (
				<GradebookSetupView data={loaderData} hasExtraCredit={hasExtraCredit} displayTotal={displayTotal} extraCreditItems={extraCreditItems} totalMaxGrade={totalMaxGrade} />
			) : (
				<GraderReportView data={loaderData} />
			)}
		</>
	);
}
