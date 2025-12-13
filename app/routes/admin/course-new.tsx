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
import { redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateCourse } from "server/internal/course-management";
import type { Course } from "server/payload-types";
import z from "zod";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course-new";
import { createLocalReq } from "server/internal/utils/internal-function-utils";
import { getDataAndContentTypeFromRequest } from "app/utils/get-content-type";
import { Result } from "node_modules/typescript-result/dist";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
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
	const categories = await payload.find({
		collection: "course-categories",
		limit: 100,
		sort: "name",
		req: payloadRequest,
	});

	return {
		success: true,
		categories: categories.docs.map((cat) => ({
			value: cat.id.toString(),
			label: cat.name,
		})),
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Wrap this with try because it is possible to throw error
	const result = await Result.try(() =>
		getDataAndContentTypeFromRequest(request),
	);

	if (!result.ok)
		return badRequest({
			success: false,
			error: result.error.message,
		});

	const { data } = result.value;

	const parsed = z
		.object({
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
			category: z.coerce.number().nullish(),
		})
		.safeParse(data);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: parsed.error.issues[0]?.message ?? "Validation error",
		});
	}

	// Create course
	const createResult = await tryCreateCourse({
		payload,
		data: {
			title: parsed.data.title,
			slug: parsed.data.slug,
			description: parsed.data.description,
			status: parsed.data.status,
			createdBy: currentUser.id,
			category: parsed.data.category ?? undefined,
		},
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
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
};

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
	const fetcher = useFetcher<typeof action>();

	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
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

	const handleSubmit = (values: typeof form.values) => {
		const formData = new FormData();
		formData.append("title", values.title);
		formData.append("slug", values.slug);
		formData.append("description", values.description);
		formData.append("status", values.status ?? "draft");

		if (values.category) {
			formData.append("category", values.category);
		}

		fetcher.submit(formData, {
			method: "POST",
		});
	};

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

				<fetcher.Form method="POST" onSubmit={form.onSubmit(handleSubmit)}>
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
							<Button
								type="submit"
								loading={fetcher.state !== "idle"}
								disabled={fetcher.state !== "idle"}
							>
								Create Course
							</Button>
						</Group>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
