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
import { createLoader, parseAsInteger } from "nuqs/server";
import { href, redirect, useFetcher, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateSection,
	tryFindSectionsByCourse,
} from "server/internal/course-section-management";
import { assertRequestMethod } from "~/utils/assert-request-method";
import {
	badRequest,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/section-new";

// Define search params for parent section prefill
export const sectionNewSearchParams = {
	parentSection: parseAsInteger,
};

export const loadSearchParams = createLoader(sectionNewSearchParams);

export const loader = async ({
	request,
	context,
	params,
}: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const { courseId } = params;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (Number.isNaN(courseId)) {
		throw new ForbiddenResponse("Invalid course ID");
	}

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can edit
	const canEdit =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		courseContext.course.enrollments.some(
			(enrollment) =>
				enrollment.userId === currentUser.id &&
				(enrollment.role === "teacher" || enrollment.role === "ta"),
		);

	if (!canEdit) {
		throw new ForbiddenResponse(
			"You don't have permission to create sections in this course",
		);
	}

	// Get search params for parent section prefill
	const { parentSection } = loadSearchParams(request);

	// Fetch all sections for parent dropdown
	const { payload } = context.get(globalContextKey);
	const sectionsResult = await tryFindSectionsByCourse({
		payload,
		courseId: Number(courseId),
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	const sections = sectionsResult.ok ? sectionsResult.value : [];

	return {
		course: courseContext.course,
		sections,
		currentUser,
		parentSectionId: parentSection,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const { courseId } = params;
	const formData = await request.formData();
	const title = formData.get("title") as string;
	const description = formData.get("description") as string;
	const parentSectionIdStr = formData.get("parentSection") as string;

	if (!title || title.trim().length === 0) {
		return badRequest({ error: "Section title is required" });
	}

	if (!description || description.trim().length === 0) {
		return badRequest({ error: "Section description is required" });
	}

	const parentSectionId =
		parentSectionIdStr && parentSectionIdStr !== ""
			? Number.parseInt(parentSectionIdStr, 10)
			: undefined;

	if (parentSectionIdStr && Number.isNaN(parentSectionId)) {
		return badRequest({ error: "Invalid parent section ID" });
	}

	// Create the section
	const result = await tryCreateSection({
		payload,
		data: {
			course: Number(courseId),
			title: title.trim(),
			description: description.trim(),
			parentSection: parentSectionId,
		},
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	const newSection = result.value;

	// Redirect to the new section page
	return redirect(
		href("/course/section/:sectionId", { sectionId: newSection.id.toString() }),
	);
};

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

function useCreateNewSection() {
	const fetcher = useFetcher<typeof action>();

	const handleSubmit = (values: CreateSectionFormValues) => {
		const formData = new FormData();
		formData.append("title", values.title);
		formData.append("description", values.description);
		formData.append("parentSection", values.parentSection);
		fetcher.submit(formData, { method: "POST" });
	};

	return {
		handleSubmit,
		isLoading: fetcher.state !== "idle",
		state: fetcher.state,
	};
}

export default function SectionNewPage({ loaderData }: Route.ComponentProps) {
	const { course, sections, parentSectionId } = loaderData;
	const navigate = useNavigate();
	const { handleSubmit, isLoading } = useCreateNewSection();

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
					<form onSubmit={form.onSubmit(handleSubmit)}>
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
										navigate(href("/course/:courseId", { courseId: course.id.toString() }))
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
