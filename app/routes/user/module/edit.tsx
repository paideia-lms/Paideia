import {
	Button,
	Checkbox,
	Container,
	List,
	NumberInput,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
	href,
	Link,
	redirect,
	useFetcher,
	useLoaderData,
} from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	tryGrantAccessToActivityModule,
	tryRevokeAccessFromActivityModule,
} from "server/internal/activity-module-access";
import { tryUpdateActivityModule } from "server/internal/activity-module-management";
import { z } from "zod";
import { GrantAccessSection } from "~/components/grant-access-section";
import {
	type ActivityModuleFormValues,
	activityModuleSchema,
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
	badRequest,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userModuleContext = context.get(userModuleContextKey);

	if (!userModuleContext) {
		throw new NotFoundResponse("Module context not found");
	}

	return {
		module: userModuleContext.module,
		links: userModuleContext.links,
		linkedCourses: userModuleContext.linkedCourses,
		grants: userModuleContext.grants,
		instructors: userModuleContext.instructors,
	};
};

// the schema
const updateActivityModuleSchema = z.object({
	intent: z.literal("update-module"),
	title: z.string().min(1),
	description: z.string().min(1),
	status: z.string().min(1),
	requirePassword: z.boolean(),
	accessPassword: z.string().min(1),
});

const grantAccessSchema = z.object({
	intent: z.literal("grant-access"),
	userId: z.number(),
	notifyPeople: z.boolean(),
});

const revokeAccessSchema = z.object({
	intent: z.literal("revoke-access"),
	userId: z.number(),
});

const acitonSchema = z.discriminatedUnion("intent", [updateActivityModuleSchema, grantAccessSchema, revokeAccessSchema]);

export const action = async ({ request, context, params }: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to edit modules",
		});
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const moduleId = params.moduleId;
	if (!moduleId) {
		return badRequest({
			success: false,
			error: "Module ID is required",
		});
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = acitonSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: parsed.error.message,
		});
	}

	// Check if this is a grant/revoke action
	if (parsed.data.intent === "grant-access") {
		const grantResult = await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: Number(moduleId),
			grantedToUserId: Number(parsed.data.userId),
			grantedByUserId: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id,
			},
			req: request,
			overrideAccess: false,
		});

		if (!grantResult.ok) {
			return badRequest({
				success: false,
				error: grantResult.error.message,
			});
		}

		return ok({ success: true, message: "Access granted successfully" });
	}

	if (parsed.data.intent === "revoke-access") {
		const revokeResult = await tryRevokeAccessFromActivityModule({
			payload,
			activityModuleId: Number(moduleId),
			userId: Number(parsed.data.userId),
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id,
			},
			req: request,
			overrideAccess: false,
		});

		if (!revokeResult.ok) {
			return badRequest({
				success: false,
				error: revokeResult.error.message,
			});
		}

		return ok({ success: true, message: "Access revoked successfully" });
	}

	// Continue with existing module update logic
	const parsedData = activityModuleSchema.parse(data);

	const { assignmentData, quizData, discussionData } =
		transformToActivityData(parsedData);

	const updateResult = await tryUpdateActivityModule(payload, {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		assignmentData,
		quizData,
		discussionData,
		requirePassword: parsedData.requirePassword,
		accessPassword: parsedData.accessPassword,
	});

	if (!updateResult.ok) {
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	throw redirect("/user/profile");
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: "Activity module updated successfully",
			color: "green",
		});
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

export default function EditModulePage() {
	const { module, linkedCourses, links, grants, instructors } =
		useLoaderData<typeof loader>();
	const fetcher = useFetcher<typeof clientAction>();

	// Extract activity-specific data
	const assignmentData = module.assignment;
	const quizData = module.quiz;
	const discussionData = module.discussion;

	// Grant access handlers
	const handleGrantAccess = (userIds: number[], notifyPeople: boolean) => {
		for (const userId of userIds) {
			fetcher.submit(
				{
					intent: "grant-access",
					userId: userId.toString(),
					notifyPeople: notifyPeople.toString(),
				},
				{ method: "POST", encType: "application/json" },
			);
		}
	};

	const handleRevokeAccess = (userId: number) => {
		fetcher.submit(
			{ intent: "revoke-access", userId: userId.toString() },
			{ method: "POST", encType: "application/json" },
		);
	};


	// Calculate exclude user IDs
	const grantedUserIds = grants.map((g) => g.grantedTo.id);
	const instructorIds = instructors.map((i) => i.id);
	const ownerId = module.owner.id;
	const excludeUserIds = [ownerId, ...grantedUserIds, ...instructorIds];

	const form = useForm<ActivityModuleFormValues>({
		mode: "uncontrolled",
		initialValues: {
			title: module.title,
			description: module.description || "",
			type: module.type,
			status: module.status,
			requirePassword: module.requirePassword || false,
			accessPassword: module.accessPassword || "",
			// Assignment fields
			assignmentInstructions: assignmentData?.instructions || "",
			assignmentDueDate: assignmentData?.dueDate
				? new Date(assignmentData.dueDate)
				: null,
			assignmentMaxAttempts: assignmentData?.maxAttempts || 1,
			assignmentAllowLateSubmissions:
				assignmentData?.allowLateSubmissions || false,
			assignmentRequireTextSubmission:
				assignmentData?.requireTextSubmission || false,
			assignmentRequireFileSubmission:
				assignmentData?.requireFileSubmission || false,
			// Quiz fields
			quizInstructions: quizData?.instructions || "",
			quizDueDate: quizData?.dueDate ? new Date(quizData.dueDate) : null,
			quizMaxAttempts: quizData?.maxAttempts || 1,
			quizPoints: quizData?.points || 100,
			quizTimeLimit: quizData?.timeLimit || 60,
			quizGradingType: quizData?.gradingType || "automatic",
			// Discussion fields
			discussionInstructions: discussionData?.instructions || "",
			discussionDueDate: discussionData?.dueDate
				? new Date(discussionData.dueDate)
				: null,
			discussionRequireThread: discussionData?.requireThread || false,
			discussionRequireReplies: discussionData?.requireReplies || false,
			discussionMinReplies: discussionData?.minReplies || 1,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	const selectedType = form.getValues().type;

	return (
		<Container size="md" py="xl">
			<title>Edit Activity Module | Paideia LMS</title>
			<meta
				name="description"
				content="Edit an activity module in Paideia LMS"
			/>
			<meta property="og:title" content="Edit Activity Module | Paideia LMS" />
			<meta
				property="og:description"
				content="Edit an activity module in Paideia LMS"
			/>

			<Stack gap="xl">
				{/* Linked Courses Section */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={3} mb="lg">
						Linked Courses
					</Title>
					{links.length === 0 ? (
						<Text c="dimmed" ta="center" py="xl">
							This module is not linked to any courses yet.
						</Text>
					) : (
						<Table.ScrollContainer minWidth={600}>
							<Table striped highlightOnHover>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Course Name</Table.Th>
										<Table.Th>Course Slug</Table.Th>
										<Table.Th>Usage</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{linkedCourses.map((course) => (
										<Table.Tr key={course.id}>
											<Table.Td>
												<Text
													component="a"
													href={href("/course/:id", { id: String(course.id) })}
													fw={500}
													style={{ textDecoration: "none" }}
												>
													{course.title}
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													{course.slug}
												</Text>
											</Table.Td>
											<Table.Td>
												<List>
													{links.filter(l => l.course.id === course.id).map(l => {
														// show the link to /course/module/:id
														return (
															<List.Item key={l.id}>
																<Text component={Link} to={href("/course/module/:id", { id: String(l.id) })} fw={500}>
																	{l.activityModule.title}
																</Text>
															</List.Item>
														);
													})}
												</List>
											</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					)}
				</Paper>

				{/* User Access Section */}
				<GrantAccessSection
					grants={grants}
					instructors={instructors}
					fetcherState={fetcher.state}
					onGrantAccess={handleGrantAccess}
					onRevokeAccess={handleRevokeAccess}
					excludeUserIds={excludeUserIds}
				/>

				{/* Edit Form */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="lg">
						Edit Activity Module
					</Title>

					<fetcher.Form
						method="POST"
						onSubmit={form.onSubmit((values) => {
							const submissionData = transformFormValues(values);
							fetcher.submit(submissionData, {
								method: "POST",
								encType: "application/json",
							});
						})}
					>
						<Stack gap="md">
							<TextInput
								{...form.getInputProps("title")}
								key={form.key("title")}
								label="Title"
								placeholder="Enter module title"
								required
								withAsterisk
							/>

							<Textarea
								{...form.getInputProps("description")}
								key={form.key("description")}
								label="Description"
								placeholder="Enter module description"
								minRows={3}
							/>

							<Select
								{...form.getInputProps("type")}
								key={form.key("type")}
								label="Module Type"
								placeholder="Select module type"
								required
								withAsterisk
								disabled
								data={[
									{ value: "page", label: "Page" },
									{ value: "whiteboard", label: "Whiteboard" },
									{ value: "assignment", label: "Assignment" },
									{ value: "quiz", label: "Quiz" },
									{ value: "discussion", label: "Discussion" },
								]}
							/>

							<Select
								{...form.getInputProps("status")}
								key={form.key("status")}
								label="Status"
								placeholder="Select status"
								data={[
									{ value: "draft", label: "Draft" },
									{ value: "published", label: "Published" },
									{ value: "archived", label: "Archived" },
								]}
							/>

							<Checkbox
								{...form.getInputProps("requirePassword", { type: "checkbox" })}
								key={form.key("requirePassword")}
								label="Require password to access"
							/>

							{form.getValues().requirePassword && (
								<TextInput
									{...form.getInputProps("accessPassword")}
									key={form.key("accessPassword")}
									label="Access Password"
									placeholder="Enter access password"
								/>
							)}

							{/* Assignment-specific fields */}
							{selectedType === "assignment" && (
								<>
									<Title order={4} mt="md">
										Assignment Settings
									</Title>
									<Textarea
										{...form.getInputProps("assignmentInstructions")}
										key={form.key("assignmentInstructions")}
										label="Instructions"
										placeholder="Enter assignment instructions"
										minRows={3}
									/>
									<DateTimePicker
										{...form.getInputProps("assignmentDueDate")}
										key={form.key("assignmentDueDate")}
										label="Due Date"
										placeholder="Select due date"
									/>
									<NumberInput
										{...form.getInputProps("assignmentMaxAttempts")}
										key={form.key("assignmentMaxAttempts")}
										label="Max Attempts"
										placeholder="Enter max attempts"
										min={1}
									/>
									<Checkbox
										{...form.getInputProps("assignmentAllowLateSubmissions", {
											type: "checkbox",
										})}
										key={form.key("assignmentAllowLateSubmissions")}
										label="Allow late submissions"
									/>
									<Checkbox
										{...form.getInputProps("assignmentRequireTextSubmission", {
											type: "checkbox",
										})}
										key={form.key("assignmentRequireTextSubmission")}
										label="Require text submission"
									/>
									<Checkbox
										{...form.getInputProps("assignmentRequireFileSubmission", {
											type: "checkbox",
										})}
										key={form.key("assignmentRequireFileSubmission")}
										label="Require file submission"
									/>
								</>
							)}

							{/* Quiz-specific fields */}
							{selectedType === "quiz" && (
								<>
									<Title order={4} mt="md">
										Quiz Settings
									</Title>
									<Textarea
										{...form.getInputProps("quizInstructions")}
										key={form.key("quizInstructions")}
										label="Instructions"
										placeholder="Enter quiz instructions"
										minRows={3}
									/>
									<DateTimePicker
										{...form.getInputProps("quizDueDate")}
										key={form.key("quizDueDate")}
										label="Due Date"
										placeholder="Select due date"
									/>
									<NumberInput
										{...form.getInputProps("quizMaxAttempts")}
										key={form.key("quizMaxAttempts")}
										label="Max Attempts"
										placeholder="Enter max attempts"
										min={1}
									/>
									<NumberInput
										{...form.getInputProps("quizPoints")}
										key={form.key("quizPoints")}
										label="Total Points"
										placeholder="Enter total points"
										min={0}
									/>
									<NumberInput
										{...form.getInputProps("quizTimeLimit")}
										key={form.key("quizTimeLimit")}
										label="Time Limit (minutes)"
										placeholder="Enter time limit in minutes"
										min={1}
									/>
									<Select
										{...form.getInputProps("quizGradingType")}
										key={form.key("quizGradingType")}
										label="Grading Type"
										data={[
											{ value: "automatic", label: "Automatic" },
											{ value: "manual", label: "Manual" },
										]}
									/>
								</>
							)}

							{/* Discussion-specific fields */}
							{selectedType === "discussion" && (
								<>
									<Title order={4} mt="md">
										Discussion Settings
									</Title>
									<Textarea
										{...form.getInputProps("discussionInstructions")}
										key={form.key("discussionInstructions")}
										label="Instructions"
										placeholder="Enter discussion instructions"
										minRows={3}
									/>
									<DateTimePicker
										{...form.getInputProps("discussionDueDate")}
										key={form.key("discussionDueDate")}
										label="Due Date"
										placeholder="Select due date"
									/>
									<Checkbox
										{...form.getInputProps("discussionRequireThread", {
											type: "checkbox",
										})}
										key={form.key("discussionRequireThread")}
										label="Require thread creation"
									/>
									<Checkbox
										{...form.getInputProps("discussionRequireReplies", {
											type: "checkbox",
										})}
										key={form.key("discussionRequireReplies")}
										label="Require replies"
									/>
									{form.getValues().discussionRequireReplies && (
										<NumberInput
											{...form.getInputProps("discussionMinReplies")}
											key={form.key("discussionMinReplies")}
											label="Minimum Replies"
											placeholder="Enter minimum number of replies"
											min={1}
										/>
									)}
								</>
							)}

							<Button
								type="submit"
								size="lg"
								mt="lg"
								loading={fetcher.state === "submitting"}
							>
								Update Module
							</Button>
						</Stack>
					</fetcher.Form>
				</Paper>
			</Stack>
		</Container>
	);
}
