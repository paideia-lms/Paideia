import {
	ActionIcon,
	Box,
	Button,
	Checkbox,
	Group,
	NumberInput,
	Paper,
	Stack,
	Tabs,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import type { NestedQuizConfig } from "server/json/raw-quiz-config/types.v2";
import { assertZodInternal } from "server/utils/type-narrowing";
import z from "zod";
import type { QuizModuleFormValues } from "~/utils/activity-module-schema";
import { getPath, useFormWatchForceUpdate } from "~/utils/form-utils";
import { GradingConfigEditor, QuestionsList, ResourcesList } from "./others";

// ============================================================================
// REGULAR QUIZ BUILDER (with drag-and-drop list)
// ============================================================================

interface RegularQuizBuilderProps {
	form: UseFormReturnType<QuizModuleFormValues>;
}

export function RegularQuizBuilder({ form }: RegularQuizBuilderProps) {
	// Convert pages structure to flat list with page breaks
	// const itemsToList = (): QuestionOrPageBreak[] => {
	//     const result: QuestionOrPageBreak[] = [];
	//     const pages = config.pages || [];

	//     pages.forEach((page, pageIndex) => {
	//         page.questions.forEach((question) => {
	//             result.push({ type: "question", data: question });
	//         });

	//         // Add page break between pages (but not after the last page)
	//         if (pageIndex < pages.length - 1) {
	//             result.push({ type: "pageBreak", id: `pageBreak-${pageIndex}` });
	//         }
	//     });

	//     return result;
	// };

	// // Convert flat list back to pages structure
	// // Page breaks split items into pages, even if pages are empty
	// const listToPages = (items: QuestionOrPageBreak[]) => {
	//     if (items.length === 0) {
	//         return [];
	//     }

	//     const pages: RegularQuizConfig["pages"] = [];
	//     let currentPage: Question[] = [];

	//     items.forEach((item) => {
	//         if (item.type === "question") {
	//             currentPage.push(item.data);
	//         } else if (item.type === "pageBreak") {
	//             // Always create a page at page break boundary (even if empty)
	//             pages.push({
	//                 id: `page-${Date.now()}-${pages.length}`,
	//                 title: `Page ${pages.length + 1}`,
	//                 questions: currentPage,
	//             });
	//             currentPage = [];
	//         }
	//     });

	//     // Always add the last page (even if empty)
	//     pages.push({
	//         id: `page-${Date.now()}-${pages.length}`,
	//         title: `Page ${pages.length + 1}`,
	//         questions: currentPage,
	//     });

	//     return pages;
	// };

	// const handleItemsChange = (items: QuestionOrPageBreak[]) => {
	//     const pages = listToPages(items);
	//     form.setFieldValue("rawQuizConfig.pages", pages);
	// };

	return (
		<Stack gap="lg">
			<TextInput
				label="Quiz Title"
				{...form.getInputProps("rawQuizConfig.title")}
				key={form.key("rawQuizConfig.title")}
				required
			/>

			<NumberInput
				label="Global Timer (seconds)"
				description="Timer for the entire quiz (optional)"
				{...form.getInputProps("rawQuizConfig.globalTimer")}
				key={form.key("rawQuizConfig.globalTimer")}
				min={0}
			/>
			<GradingConfigEditor form={form} path="rawQuizConfig.grading" />

			<Box>
				<Title order={4} mb="md">
					Resources
				</Title>
				<Text size="sm" c="dimmed" mb="md">
					Resources are rich text content that can be displayed on selected quiz
					pages
				</Text>
				<ResourcesList
					form={form}
					path="rawQuizConfig.resources"
					pagesPath="rawQuizConfig.pages"
				/>
			</Box>

			<Box>
				<Title order={4} mb="md">
					Questions
				</Title>
				<QuestionsList form={form} path="rawQuizConfig.pages" />
			</Box>
		</Stack>
	);
}

// ============================================================================
// NESTED QUIZ TAB (with drag-and-drop list)
// ============================================================================

interface NestedQuizTabProps {
	form: UseFormReturnType<QuizModuleFormValues>;
	quizIndex: number;
}

function NestedQuizTab({ form, quizIndex }: NestedQuizTabProps) {
	// type narrowing
	const _rawQuizConfig = form.getValues().rawQuizConfig;
	assertZodInternal(
		"NestedQuizTab: rawQuizConfig should be a nested quiz",
		_rawQuizConfig,
		z.object({
			type: z.literal("container"),
		}),
	);

	return (
		<Stack gap="md">
			<TextInput
				{...form.getInputProps(
					`rawQuizConfig.nestedQuizzes.${quizIndex}.title`,
				)}
				key={form.key(`rawQuizConfig.nestedQuizzes.${quizIndex}.title`)}
				label="Quiz Title"
			/>

			<Textarea
				{...form.getInputProps(
					`rawQuizConfig.nestedQuizzes.${quizIndex}.description`,
				)}
				key={form.key(`rawQuizConfig.nestedQuizzes.${quizIndex}.description`)}
				label="Description (optional)"
				minRows={2}
			/>

			<NumberInput
				{...form.getInputProps(
					`rawQuizConfig.nestedQuizzes.${quizIndex}.globalTimer`,
				)}
				key={form.key(`rawQuizConfig.nestedQuizzes.${quizIndex}.globalTimer`)}
				label="Time Limit (seconds)"
				description="Timer for this quiz (optional)"
				min={0}
			/>

			<GradingConfigEditor
				form={form}
				path={`rawQuizConfig.nestedQuizzes.${quizIndex}.grading`}
			/>

			<Box>
				<Title order={5} mb="md">
					Resources
				</Title>
				<Text size="sm" c="dimmed" mb="sm">
					Resources are rich text content that can be displayed on selected quiz
					pages
				</Text>
				<ResourcesList
					form={form}
					path={`rawQuizConfig.nestedQuizzes.${quizIndex}.resources`}
					pagesPath={`rawQuizConfig.nestedQuizzes.${quizIndex}.pages`}
				/>
			</Box>

			<Box>
				<Title order={5} mb="md">
					Questions
				</Title>
				<QuestionsList
					form={form}
					path={`rawQuizConfig.nestedQuizzes.${quizIndex}.pages`}
				/>
			</Box>
		</Stack>
	);
}

// ============================================================================
// CONTAINER QUIZ BUILDER (with Tabs)
// ============================================================================

interface ContainerQuizBuilderProps {
	form: UseFormReturnType<QuizModuleFormValues>;
}

export function ContainerQuizBuilder({ form }: ContainerQuizBuilderProps) {
	// type narrowing
	const nestedQuizzes = useFormWatchForceUpdate(
		form,
		"rawQuizConfig.nestedQuizzes",
		({ previousValue, value }) => {
			const oldQuizzes = previousValue.map((quiz) => ({
				id: quiz.id,
				title: quiz.title,
			}));
			const newQuizzes = value.map((quiz) => ({
				id: quiz.id,
				title: quiz.title,
			}));
			return JSON.stringify(oldQuizzes) !== JSON.stringify(newQuizzes);
		},
	);

	const [activeTab, setActiveTab] = useState<string | null>(
		nestedQuizzes[0]?.id || null,
	);

	const addNestedQuiz = () => {
		// const quizzes = form.getValues().rawQuizConfig.nestedQuizzes;
		const newQuiz: NestedQuizConfig = {
			id: `nested-${Date.now()}`,
			title: `Quiz ${nestedQuizzes.length + 1}`,
			pages: [],
		};

		const value = getPath("rawQuizConfig.nestedQuizzes", form.getValues());
		form.setFieldValue("rawQuizConfig.nestedQuizzes", [...value, newQuiz]);
		setActiveTab(newQuiz.id);
	};

	const removeNestedQuiz = (index: number) => {
		if (nestedQuizzes.length === 1) {
			return;
		}
		const value = getPath("rawQuizConfig.nestedQuizzes", form.getValues());
		form.setFieldValue(
			"rawQuizConfig.nestedQuizzes",
			value.filter((_, i) => i !== index),
			{ forceUpdate: false },
		);
		if (activeTab === nestedQuizzes[index]!.id && nestedQuizzes.length > 1) {
			setActiveTab(
				nestedQuizzes[0]!.id === nestedQuizzes[index]!.id
					? nestedQuizzes[1]!.id
					: nestedQuizzes[0]!.id,
			);
		}
	};

	return (
		<Stack gap="lg">
			<TextInput
				{...form.getInputProps("rawQuizConfig.title")}
				key={form.key("rawQuizConfig.title")}
				label="Container Quiz Title"
				required
			/>

			<Checkbox
				{...form.getInputProps("rawQuizConfig.sequentialOrder", {
					type: "checkbox",
				})}
				key={form.key("rawQuizConfig.sequentialOrder")}
				label="Sequential Order"
				description="Quizzes must be completed in order"
			/>

			<NumberInput
				{...form.getInputProps("rawQuizConfig.globalTimer")}
				key={form.key("rawQuizConfig.globalTimer")}
				min={0}
				label="Global Timer (seconds)"
				description="Parent-level timer for all quizzes (optional)"
			/>

			<GradingConfigEditor form={form} path="rawQuizConfig.grading" />

			<Box>
				<Group justify="space-between" mb="md">
					<Title order={4}>Nested Quizzes</Title>
					<Button leftSection={<IconPlus size={16} />} onClick={addNestedQuiz}>
						Add Quiz
					</Button>
				</Group>

				{nestedQuizzes.length === 0 ? (
					<Paper withBorder p="xl" radius="md">
						<Text ta="center" c="dimmed">
							No quizzes yet. Click "Add Quiz" to create your first quiz.
						</Text>
					</Paper>
				) : (
					<Tabs value={activeTab} onChange={setActiveTab}>
						<Tabs.List>
							{nestedQuizzes.map((quiz, index) => (
								<Tabs.Tab key={quiz.id} value={quiz.id}>
									{quiz.title || `Quiz ${index + 1}`}
								</Tabs.Tab>
							))}
						</Tabs.List>

						{nestedQuizzes.map((quiz, index) => (
							<Tabs.Panel key={quiz.id} value={quiz.id} pt="md">
								<Stack gap="md">
									{/* Header with quiz title and remove button */}
									<Group justify="space-between">
										<Title order={5}>{quiz.title || `Quiz ${index + 1}`}</Title>
										<ActionIcon
											color="red"
											variant="subtle"
											onClick={() => removeNestedQuiz(index)}
											title="Remove this quiz"
											// user cannot remove the last quiz
											disabled={nestedQuizzes.length === 1}
										>
											<IconTrash size={16} />
										</ActionIcon>
									</Group>

									<NestedQuizTab form={form} quizIndex={index} />
								</Stack>
							</Tabs.Panel>
						))}
					</Tabs>
				)}
			</Box>
		</Stack>
	);
}
