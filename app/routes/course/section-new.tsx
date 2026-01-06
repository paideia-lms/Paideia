import {
	Button,
	Container,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { parseAsInteger } from "nuqs/server";
import { href, redirect, useNavigate } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { z } from "zod";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateSection,
	tryFindSectionsByCourse,
} from "server/internal/course-section-management";
import { permissions } from "server/utils/permissions";
import {
	badRequest,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/section-new";
import { getRouteUrl } from "app/utils/search-params-utils";

// Define search params for parent section prefill
export const loaderSearchParams = {
	parentSection: parseAsInteger,
};

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/course/:courseId/section/new",
});

const createSectionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1, "Section title is required"),
		description: z.string().min(1, "Section description is required"),
		parentSection: z.string().optional(),
	}),
	method: "POST",
});

const createSectionAction = createSectionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { courseId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const parentSectionId =
			formData.parentSection && formData.parentSection !== ""
				? Number.parseInt(formData.parentSection, 10)
				: undefined;

		if (formData.parentSection && Number.isNaN(parentSectionId)) {
			return badRequest({ error: "Invalid parent section ID" });
		}

		// Create the section
		const result = await tryCreateSection({
			payload,
			data: {
				course: Number(courseId),
				title: formData.title.trim(),
				description: formData.description.trim(),
				parentSection: parentSectionId,
			},
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		const newSection = result.value;

		// Redirect to the new section page
		return redirect(
			href("/course/section/:sectionId", {
				sectionId: newSection.id.toString(),
			}),
		);
	},
);

const useCreateSection = createSectionRpc.createHook<typeof createSectionAction>();

// Export hook for use in component
export { useCreateSection };

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, params, searchParams }) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const { courseId } = params;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can edit sections
	const editPermission = permissions.course.section.canEdit(
		currentUser,
		courseContext.course.enrollments.map((enrollment) => ({
			userId: enrollment.user.id,
			role: enrollment.role,
		})),
	);

	if (!editPermission.allowed) {
		throw new ForbiddenResponse(editPermission.reason);
	}


	// Fetch all sections for parent dropdown
	const { payload, payloadRequest } = context.get(globalContextKey);
	const sectionsResult = await tryFindSectionsByCourse({
		payload,
		courseId: courseId,
		req: payloadRequest,
		overrideAccess: false,
	});

	const sections = sectionsResult.ok ? sectionsResult.value : [];

	return {
		course: courseContext.course,
		sections,
		currentUser,
		parentSectionId: searchParams.parentSection,
		searchParams,
	};
});

export const action = createSectionAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message:
				typeof actionData.error === "string"
					? actionData.error
					: "Failed to create section",
			color: "red",
		});
	}

	return actionData;
}

interface CreateSectionFormValues {
	title: string;
	description: string;
	parentSection: string;
}

export default function SectionNewPage({ loaderData }: Route.ComponentProps) {
	const { course, sections, parentSectionId } = loaderData;
	const navigate = useNavigate();
	const { submit: createSection, isLoading } = useCreateSection();

	const sectionOptions = [
		{ value: "", label: "None (Root Level)" },
		...sections.map((section) => ({
			value: section.id.toString(),
			label: section.title,
		})),
	];

	const form = useForm<CreateSectionFormValues>({
		mode: "uncontrolled",
		initialValues: {
			title: "",
			description: "",
			parentSection: parentSectionId ? parentSectionId.toString() : "",
		},
		validate: {
			title: (value) =>
				!value || value.trim().length === 0
					? "Section title is required"
					: null,
			description: (value) =>
				!value || value.trim().length === 0
					? "Section description is required"
					: null,
		},
	});

	return (
		<Container size="md" py="xl">
			<title>Create Section | {course.title} | Paideia LMS</title>
			<meta name="description" content="Create a new section" />

			<Stack gap="xl">
				<div>
					<Title order={1}>Create New Section</Title>
					<Text c="dimmed" size="sm">
						Course: {course.title}
					</Text>
				</div>

				<Paper shadow="sm" p="xl" withBorder>
					<form
						onSubmit={form.onSubmit(async (values) => {
							await createSection({
								values: {
									title: values.title,
									description: values.description,
									parentSection: values.parentSection || undefined,
								},
								params: { courseId: course.id },
							});
						})}
					>
						<Stack gap="md">
							<TextInput
								{...form.getInputProps("title")}
								key={form.key("title")}
								label="Section Title"
								placeholder="Enter section title"
								required
								disabled={isLoading}
							/>

							<Textarea
								{...form.getInputProps("description")}
								key={form.key("description")}
								label="Description"
								placeholder="Enter section description"
								required
								minRows={3}
								disabled={isLoading}
							/>

							<Select
								{...form.getInputProps("parentSection")}
								key={form.key("parentSection")}
								label="Parent Section"
								placeholder="Select parent section (optional)"
								data={sectionOptions}
								clearable
								disabled={isLoading}
								description="Leave empty to create a root-level section"
							/>

							<Group justify="flex-end" mt="md">
								<Button
									variant="subtle"
									onClick={() =>
										navigate(
											getRouteUrl("/course/:courseId", {
												params: { courseId: course.id.toString(), },
												searchParams: {},
											}),
										)
									}
									disabled={isLoading}
								>
									Cancel
								</Button>
								<Button type="submit" loading={isLoading}>
									Create Section
								</Button>
							</Group>
						</Stack>
					</form>
				</Paper>
			</Stack>
		</Container>
	);
}
