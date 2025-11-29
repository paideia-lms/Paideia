import {
	Button,
	Container,
	Group,
	Paper,
	Select,
	Stack,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateCategory } from "server/internal/course-category-management";
import z from "zod";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/category-new";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.authenticatedUser) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (userSession.authenticatedUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can create categories");
	}

	const categories = await payload.find({
		collection: "course-categories",
		limit: 100,
		sort: "name",
	});

	return {
		categories: categories.docs.map((cat) => ({
			value: String(cat.id),
			label: cat.name,
		})),
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		return unauthorized({ success: false, error: "Unauthorized" });
	}

	try {
		const formData = await request.formData();
		const parsed = z
			.object({
				name: z.string().min(1, "Name is required"),
				parent: z.coerce.number().optional().nullable(),
			})
			.safeParse({
				name: formData.get("name"),
				parent: formData.get("parent"),
			});

		if (!parsed.success) {
			return badRequest({
				success: false,
				error: parsed.error.issues[0]?.message ?? "Validation error",
			});
		}

		const createResult = await tryCreateCategory({
			payload,
			req: request,
			name: parsed.data.name,
			parent: parsed.data.parent ?? undefined,
		});

		if (!createResult.ok) {
			return badRequest({ success: false, error: createResult.error.message });
		}

		return ok({ success: true, id: createResult.value.id });
	} catch (error) {
		return badRequest({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to create category",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();
	if (actionData?.success && actionData.status === 200) {
		notifications.show({
			title: "Category created",
			message: "The category has been created",
			color: "green",
		});
		return redirect(href("/admin/categories"));
	}
	if (actionData && "error" in actionData) {
		notifications.show({
			title: "Creation failed",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

import { href } from "react-router";

export default function NewCategoryPage({ loaderData }: Route.ComponentProps) {
	const fetcher = useFetcher<typeof clientAction>();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: { name: "", parent: "" },
		validate: { name: (v) => (!v ? "Name is required" : null) },
	});

	const handleSubmit = (values: typeof form.values) => {
		const formData = new FormData();
		formData.append("name", values.name);
		if (values.parent) formData.append("parent", values.parent);
		fetcher.submit(formData, { method: "POST" });
	};

	return (
		<Container size="sm" py="xl">
			<title>Create Category | Admin | Paideia LMS</title>
			<meta name="description" content="Create a new category" />
			<meta
				property="og:title"
				content="Create Category | Admin | Paideia LMS"
			/>
			<meta property="og:description" content="Create a new category" />

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="xl">
					Create New Category
				</Title>
				<fetcher.Form method="POST" onSubmit={form.onSubmit(handleSubmit)}>
					<Stack gap="lg">
						<TextInput
							{...form.getInputProps("name")}
							key={form.key("name")}
							label="Name"
							placeholder="STEM"
							required
						/>
						<Select
							{...form.getInputProps("parent")}
							key={form.key("parent")}
							label="Parent"
							placeholder="Select parent (optional)"
							data={loaderData.categories}
							clearable
						/>
						<Group justify="flex-end" mt="md">
							<Button
								type="submit"
								loading={fetcher.state !== "idle"}
								disabled={fetcher.state !== "idle"}
							>
								Create Category
							</Button>
						</Group>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
