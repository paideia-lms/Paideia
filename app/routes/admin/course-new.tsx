import {
	Button,
	Container,
	Group,
	Paper,
	Select,
	Stack,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { redirect } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateCourse } from "server/internal/course-management";
import { tryFindAllCategories } from "server/internal/course-category-management";
import type { Course } from "server/payload-types";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	InternalServerErrorResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course-new";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/course/new",
});

const createCourseRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1, "Title is required"),
		slug: z
			.string()
			.min(1, "Slug is required")
			.regex(
				/^[a-z0-9-]+$/,
				"Slug must contain only lowercase letters, numbers, and hyphens",
			),
		description: z.string().min(1, "Description is required"),
		status: z.enum(["draft", "published", "archived"]),
		category: z.coerce.number().optional().nullable(),
	}),
	method: "POST",
});

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.authenticatedUser) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (
		userSession.authenticatedUser.role !== "admin" &&
		userSession.authenticatedUser.role !== "content-manager"
	) {
		throw new ForbiddenResponse(
			"Only admins and content managers can create courses",
		);
	}

	// Fetch categories for the dropdown
	const categoriesResult = await tryFindAllCategories({
		payload,
		req: payloadRequest,
		sort: "name",
	}).getOrElse(() => {
		throw new InternalServerErrorResponse("Failed to get categories");
	});

	return {
		success: true,
		categories: categoriesResult.map((cat) => ({
			value: cat.id.toString(),
			label: cat.name,
		})),
	};
});

const createCourseAction = createCourseRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}
		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		// Create course
		const createResult = await tryCreateCourse({
			payload,
			data: {
				title: formData.title,
				slug: formData.slug,
				description: formData.description,
				status: formData.status,
				createdBy: currentUser.id,
				category: formData.category ?? undefined,
			},
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Course created successfully",
			id: createResult.value.id,
		});
	},
);

const useCreateCourse = createCourseRpc.createHook<typeof createCourseAction>();

// Export hook for use in components
export { useCreateCourse };

export const action = createCourseAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		if (actionData.status === StatusCode.Ok) {
			notifications.show({
				title: "Course created",
				message: "The course has been created successfully",
				color: "green",
			});
			// Redirect to the newly created course's view page
			return redirect(`/course/${actionData.id}`);
		}
	} else if (
		actionData.status === StatusCode.BadRequest ||
		actionData.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Creation failed",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

export default function NewCoursePage({ loaderData }: Route.ComponentProps) {
	const { submit: createCourse, isLoading } = useCreateCourse();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			title: "",
			slug: "",
			description: "",
			status: "draft" as Course["status"],
			category: "",
		},
		validate: {
			title: (value) => (!value ? "Title is required" : null),
			slug: (value) => {
				if (!value) return "Slug is required";
				if (!/^[a-z0-9-]+$/.test(value)) {
					return "Slug must contain only lowercase letters, numbers, and hyphens";
				}
				return null;
			},
			description: (value) => (!value ? "Description is required" : null),
			status: (value) => (!value ? "Status is required" : null),
		},
	});

	const handleSubmit = form.onSubmit((values) => {
		createCourse({
			values: {
				title: values.title,
				slug: values.slug,
				description: values.description,
				status: values.status ?? "draft",
				...(values.category && { category: Number(values.category) }),
			},
		});
	});

	return (
		<Container size="sm" py="xl">
			<title>Create New Course | Paideia LMS</title>
			<meta name="description" content="Create a new course in Paideia LMS" />
			<meta property="og:title" content="Create New Course | Paideia LMS" />
			<meta
				property="og:description"
				content="Create a new course in Paideia LMS"
			/>

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="xl">
					Create New Course
				</Title>

				<form method="POST" onSubmit={handleSubmit}>
					<Stack gap="lg">
						<TextInput
							{...form.getInputProps("title")}
							key={form.key("title")}
							label="Title"
							placeholder="Introduction to Computer Science"
							required
						/>

						<TextInput
							{...form.getInputProps("slug")}
							key={form.key("slug")}
							label="Slug"
							placeholder="cs-101-spring-2025"
							required
							description="Only lowercase letters, numbers, and hyphens"
						/>

						<Textarea
							{...form.getInputProps("description")}
							key={form.key("description")}
							label="Description"
							placeholder="Enter course description"
							required
							minRows={4}
							maxRows={8}
						/>

						<Select
							{...form.getInputProps("status")}
							key={form.key("status")}
							label="Status"
							placeholder="Select status"
							required
							data={[
								{ value: "draft", label: "Draft" },
								{ value: "published", label: "Published" },
								{ value: "archived", label: "Archived" },
							]}
						/>

						<Select
							{...form.getInputProps("category")}
							key={form.key("category")}
							label="Category"
							placeholder="Select category (optional)"
							data={loaderData.categories}
							clearable
						/>

						<Group justify="flex-end" mt="md">
							<Button type="submit" loading={isLoading} disabled={isLoading}>
								Create Course
							</Button>
						</Group>
					</Stack>
				</form>
			</Paper>
		</Container>
	);
}
