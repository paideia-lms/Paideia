import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	ActionIcon,
	Box,
	Button,
	Card,
	Checkbox,
	Group,
	NumberInput,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useMounted } from "@mantine/hooks";
import {
	IconChevronDown,
	IconChevronUp,
	IconGripVertical,
	IconPlus,
	IconSeparator,
	IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import type {
	MultipleChoiceQuestion,
	Question,
	QuizPage,
	ScoringConfig,
} from "server/json/raw-quiz-config.types.v2";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { getPath, useFormWatchValue } from "~/utils/form-utils";

// ============================================================================
// TYPES FOR PAGE BREAK
// ============================================================================

export type QuestionOrPageBreak =
	| { type: "question"; data: Question }
	| { type: "pageBreak"; id: string };

// ============================================================================
// GRADING CONFIG EDITOR
// ============================================================================

export function PassScoringInput({
	form,
}: {
	form: UseFormReturnType<ActivityModuleFormValues>;
}) {
	return (
		<NumberInput
			{...form.getInputProps("rawQuizConfig.grading.passingScore")}
			key={form.key("rawQuizConfig.grading.passingScore")}
			label="Passing Score (%)"
			description="Minimum percentage to pass (0-100)"
			min={0}
			max={100}
		/>
	);
}

export interface GradingConfigEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| "rawQuizConfig.grading"
		| `rawQuizConfig.nestedQuizzes.${number}.grading`;
}

export function GradingConfigEditor({ form, path }: GradingConfigEditorProps) {
	const gradingEnabled = useFormWatchValue(form, `${path}.enabled`);

	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="sm">
				<Title order={5}>Grading Configuration</Title>

				<Checkbox
					{...form.getInputProps(`${path}.enabled`, {
						type: "checkbox",
					})}
					key={form.key(`${path}.enabled`)}
					label="Enable Grading"
				/>

				{gradingEnabled && (
					<>
						<PassScoringInput form={form} />

						<Checkbox
							{...form.getInputProps(`${path}.showScoreToStudent`, {
								type: "checkbox",
							})}
							key={form.key(`${path}.showScoreToStudent`)}
							label="Show Score to Student Immediately"
						/>

						<Checkbox
							{...form.getInputProps(`${path}.showCorrectAnswers`, {
								type: "checkbox",
							})}
							key={form.key(`${path}.showCorrectAnswers`)}
							label="Show Correct Answers After Submission"
						/>
					</>
				)}
			</Stack>
		</Paper>
	);
}

// ============================================================================
// SCORING EDITOR
// ============================================================================

export function ScoringEditor({
	questionType,
	scoring,
	onChange,
}: {
	questionType: Question["type"];
	scoring: ScoringConfig | undefined;
	onChange: (scoring: ScoringConfig) => void;
}) {
	const defaultScoring: ScoringConfig =
		questionType === "long-answer"
			? { type: "manual", maxPoints: 1 }
			: { type: "simple", points: 1 };

	const currentScoring = scoring || defaultScoring;

	if (currentScoring.type === "simple") {
		return (
			<NumberInput
				label="Points"
				description="Points awarded for correct answer"
				value={currentScoring.points}
				onChange={(val) =>
					onChange({
						type: "simple",
						points: typeof val === "number" ? val : 1,
					})
				}
				min={0}
				size="sm"
			/>
		);
	}

	if (currentScoring.type === "manual") {
		return (
			<NumberInput
				label="Maximum Points"
				description="Maximum points for manual grading"
				value={currentScoring.maxPoints}
				onChange={(val) =>
					onChange({
						type: "manual",
						maxPoints: typeof val === "number" ? val : 1,
					})
				}
				min={0}
				size="sm"
			/>
		);
	}

	return null;
}

// ============================================================================
// MULTIPLE CHOICE EDITOR
// ============================================================================

export function MultipleChoiceEditor({
	question,
	onChange,
}: {
	question: MultipleChoiceQuestion;
	onChange: (updated: Question) => void;
}) {
	const options = question.options || {};
	const optionKeys = Object.keys(options);

	const addOption = () => {
		const nextKey = String.fromCharCode(97 + optionKeys.length);
		onChange({
			...question,
			options: { ...options, [nextKey]: "" },
		});
	};

	const removeOption = (key: string) => {
		const newOptions = { ...options };
		delete newOptions[key];
		onChange({
			...question,
			options: newOptions,
			correctAnswer:
				question.correctAnswer === key ? undefined : question.correctAnswer,
		});
	};

	const updateOption = (key: string, value: string) => {
		onChange({
			...question,
			options: { ...options, [key]: value },
		});
	};

	return (
		<Stack gap="xs">
			<Group justify="space-between">
				<Text size="sm" fw={500}>
					Answer Options
				</Text>
				<Button
					size="compact-sm"
					variant="light"
					leftSection={<IconPlus size={14} />}
					onClick={addOption}
				>
					Add Option
				</Button>
			</Group>

			{optionKeys.map((key) => (
				<Group key={key} gap="xs" wrap="nowrap">
					<TextInput
						placeholder={`Option ${key.toUpperCase()} `}
						value={options[key]}
						onChange={(e) => updateOption(key, e.currentTarget.value)}
						style={{ flex: 1 }}
						size="sm"
					/>
					<Checkbox
						label="Correct"
						checked={question.correctAnswer === key}
						onChange={(e) =>
							onChange({
								...question,
								correctAnswer: e.currentTarget.checked ? key : undefined,
							})
						}
					/>
					<ActionIcon
						color="red"
						variant="subtle"
						onClick={() => removeOption(key)}
						disabled={optionKeys.length <= 2}
					>
						<IconTrash size={16} />
					</ActionIcon>
				</Group>
			))}
		</Stack>
	);
}

// ============================================================================
// SORTABLE PAGE BREAK ITEM
// ============================================================================

export interface SortablePageBreakItemProps {
	id: string;
	onRemove: () => void;
}

export function SortablePageBreakItem({
	id,
	onRemove,
}: SortablePageBreakItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.3 : 1,
	};

	return (
		<Box ref={setNodeRef} style={style}>
			<Paper withBorder p="sm" radius="md">
				<Group justify="space-between">
					<Group gap="xs">
						<ActionIcon {...attributes} {...listeners} variant="subtle">
							<IconGripVertical size={16} />
						</ActionIcon>
						<IconSeparator size={20} />
						<Text size="sm" c="dimmed" fw={500}>
							Page Break
						</Text>
					</Group>
					<ActionIcon color="red" variant="subtle" onClick={onRemove}>
						<IconTrash size={16} />
					</ActionIcon>
				</Group>
			</Paper>
		</Box>
	);
}

// ============================================================================
// SORTABLE QUESTION ITEM
// ============================================================================

export interface SortableQuestionItemProps {
	question: Question;
	questionNumber: number;
	onUpdate: (updated: Question) => void;
	onRemove: () => void;
}

export function SortableQuestionItem({
	question,
	questionNumber,
	onUpdate,
	onRemove,
}: SortableQuestionItemProps) {
	const [isExpanded, setIsExpanded] = useState(true);
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: question.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.3 : 1,
	};

	const renderQuestionTypeFields = () => {
		switch (question.type) {
			case "multiple-choice":
				return (
					<MultipleChoiceEditor
						question={question as MultipleChoiceQuestion}
						onChange={onUpdate}
					/>
				);

			case "short-answer":
				return (
					<TextInput
						label="Correct Answer (optional)"
						description="For automatic grading (exact match)"
						value={question.correctAnswer || ""}
						onChange={(e) =>
							onUpdate({
								...question,
								correctAnswer: e.currentTarget.value,
							})
						}
						size="sm"
					/>
				);

			case "long-answer":
				return (
					<Textarea
						label="Sample/Expected Answer (optional)"
						description="For reference purposes (requires manual grading)"
						value={question.correctAnswer || ""}
						onChange={(e) =>
							onUpdate({
								...question,
								correctAnswer: e.currentTarget.value,
							})
						}
						minRows={3}
						size="sm"
					/>
				);

			default:
				return <Text c="dimmed">Question type not yet implemented</Text>;
		}
	};

	const questionTypeLabel =
		question.type === "multiple-choice"
			? "Multiple Choice"
			: question.type === "short-answer"
				? "Short Answer"
				: "Long Answer";

	return (
		<Box ref={setNodeRef} style={style}>
			<Card withBorder radius="md" p="md">
				<Stack gap="sm">
					{/* Header with drag handle and collapse button */}
					<Group justify="space-between" wrap="nowrap">
						<Group gap="xs" style={{ flex: 1 }}>
							<ActionIcon
								{...attributes}
								{...listeners}
								variant="subtle"
								style={{ cursor: isDragging ? "grabbing" : "grab" }}
							>
								<IconGripVertical size={16} />
							</ActionIcon>
							<Text fw={500} size="sm">
								Question {questionNumber}: {questionTypeLabel}
							</Text>
							{!isExpanded && question.prompt && (
								<Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
									{question.prompt}
								</Text>
							)}
						</Group>
						<Group gap="xs">
							<ActionIcon
								variant="subtle"
								onClick={() => setIsExpanded(!isExpanded)}
							>
								{isExpanded ? (
									<IconChevronUp size={16} />
								) : (
									<IconChevronDown size={16} />
								)}
							</ActionIcon>
							<ActionIcon color="red" variant="subtle" onClick={onRemove}>
								<IconTrash size={16} />
							</ActionIcon>
						</Group>
					</Group>

					{/* Collapsible content */}
					{isExpanded && (
						<Stack gap="sm">
							<Select
								label="Question Type"
								value={question.type}
								onChange={(val) => {
									const baseQuestion = {
										id: question.id,
										prompt: question.prompt,
										feedback: question.feedback,
										type: val as Question["type"],
									};

									if (val === "multiple-choice") {
										onUpdate({
											...baseQuestion,
											type: "multiple-choice",
											options: { a: "Option A", b: "Option B" },
											correctAnswer: "a",
											scoring: { type: "simple", points: 1 },
										});
									} else if (val === "short-answer") {
										onUpdate({
											...baseQuestion,
											type: "short-answer",
											correctAnswer: "",
											scoring: { type: "simple", points: 1 },
										});
									} else if (val === "long-answer") {
										onUpdate({
											...baseQuestion,
											type: "long-answer",
											correctAnswer: "",
											scoring: { type: "manual", maxPoints: 1 },
										});
									}
								}}
								data={[
									{ value: "multiple-choice", label: "Multiple Choice" },
									{ value: "short-answer", label: "Short Answer" },
									{ value: "long-answer", label: "Long Answer" },
								]}
								size="sm"
							/>

							<Textarea
								label="Question Prompt"
								value={question.prompt}
								onChange={(e) =>
									onUpdate({ ...question, prompt: e.currentTarget.value })
								}
								minRows={2}
								required
								size="sm"
							/>

							{renderQuestionTypeFields()}

							<Textarea
								label="Feedback (optional)"
								description="Shown to students after answering"
								value={question.feedback || ""}
								onChange={(e) =>
									onUpdate({ ...question, feedback: e.currentTarget.value })
								}
								minRows={2}
								size="sm"
							/>

							<ScoringEditor
								questionType={question.type}
								scoring={question.scoring}
								onChange={(scoring) => onUpdate({ ...question, scoring })}
							/>
						</Stack>
					)}
				</Stack>
			</Card>
		</Box>
	);
}

// ============================================================================
// QUESTIONS LIST WITH DRAG AND DROP
// ============================================================================

export interface QuestionsListProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path: "rawQuizConfig.pages" | `rawQuizConfig.nestedQuizzes.${number}.pages`;
}

export function QuestionsList({ form, path }: QuestionsListProps) {
	const mounted = useMounted();
	const [activeId, setActiveId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const flatListItems = useFormWatchValue(form, path, {
		derived(value) {
			// convert pages to flat list items with page breaks
			const pages = (value as QuizPage[]) || [];
			const result: QuestionOrPageBreak[] = [];

			pages.forEach((page, pageIndex) => {
				if (!page || !Array.isArray(page.questions)) {
					return;
				}

				page.questions.forEach((question) => {
					result.push({
						type: "question",
						data: question,
					});
				});

				// Add page break between pages (but not after the last page)
				if (pageIndex < pages.length - 1) {
					result.push({
						type: "pageBreak",
						id: `pageBreak-${pageIndex}`,
					});
				}
			});

			return result;
		},
	});

	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = flatListItems.findIndex((item) =>
				item.type === "question"
					? item.data.id === active.id
					: item.id === active.id,
			);
			const newIndex = flatListItems.findIndex((item) =>
				item.type === "question"
					? item.data.id === over.id
					: item.id === over.id,
			);

			const newItems = arrayMove(flatListItems, oldIndex, newIndex);
			convertFlatListToPages(newItems);
		}

		setActiveId(null);
	};

	const handleDragCancel = () => {
		setActiveId(null);
	};

	const activeItem = activeId
		? flatListItems.find((item) =>
				item.type === "question"
					? item.data.id === activeId
					: item.id === activeId,
			)
		: null;

	// Convert flat list back to pages structure and update form
	const convertFlatListToPages = (items: QuestionOrPageBreak[]) => {
		if (items.length === 0) {
			form.setFieldValue(path, []);
			return;
		}

		const pages: QuizPage[] = [];
		let currentPage: Question[] = [];

		items.forEach((item) => {
			if (item.type === "question") {
				currentPage.push(item.data);
			} else if (item.type === "pageBreak") {
				pages.push({
					id: `page-${Date.now()}-${pages.length}`,
					title: `Page ${pages.length + 1}`,
					questions: currentPage,
				});
				currentPage = [];
			}
		});

		// Always add the last page
		pages.push({
			id: `page-${Date.now()}-${pages.length}`,
			title: `Page ${pages.length + 1}`,
			questions: currentPage,
		});

		form.setFieldValue(path, pages);
	};

	const addQuestion = () => {
		const currentPages = (getPath(path, form.getValues()) as QuizPage[]) || [];
		const lastPageIndex = Math.max(0, currentPages.length - 1);

		const newQuestion: Question = {
			id: `question-${Date.now()}`,
			type: "multiple-choice",
			prompt: "",
			feedback: "",
			options: { a: "Option A", b: "Option B" },
			correctAnswer: "a",
			scoring: { type: "simple", points: 1 },
		};

		if (currentPages.length === 0) {
			// Create first page with the question
			form.setFieldValue(path, [
				{
					id: `page-${Date.now()}`,
					title: "Page 1",
					questions: [newQuestion],
				},
			]);
		} else {
			// Add to last page
			const updatedPages = [...currentPages];
			updatedPages[lastPageIndex] = {
				...updatedPages[lastPageIndex],
				questions: [...updatedPages[lastPageIndex].questions, newQuestion],
			};
			form.setFieldValue(path, updatedPages);
		}
	};

	const addPageBreak = () => {
		const newItems = [
			...flatListItems,
			{
				type: "pageBreak" as const,
				id: `pageBreak-${Date.now()}`,
			},
		];
		convertFlatListToPages(newItems);
	};

	const updateQuestion = (index: number, updated: Question) => {
		const newItems = [...flatListItems];
		if (newItems[index].type === "question") {
			newItems[index] = { type: "question", data: updated };
			convertFlatListToPages(newItems);
		}
	};

	const removeItem = (index: number) => {
		const newItems = flatListItems.filter((_, i) => i !== index);
		convertFlatListToPages(newItems);
	};

	return (
		<Stack gap="md">
			<Group>
				<Button leftSection={<IconPlus size={16} />} onClick={addQuestion}>
					Add Question
				</Button>
				<Button
					leftSection={<IconSeparator size={16} />}
					variant="light"
					onClick={addPageBreak}
				>
					Add Page Break
				</Button>
			</Group>

			{flatListItems.length === 0 ? (
				<Paper withBorder p="xl" radius="md">
					<Text ta="center" c="dimmed">
						No questions yet. Click "Add Question" to get started.
					</Text>
				</Paper>
			) : !mounted ? (
				// Server-side render: static list without drag-and-drop
				<Stack gap="sm">
					{flatListItems.map((item, index) => {
						if (item.type === "pageBreak") {
							return (
								<div key={item.id}>
									<SortablePageBreakItem
										id={item.id}
										onRemove={() => removeItem(index)}
									/>
								</div>
							);
						}

						const questionNumber = flatListItems
							.slice(0, index + 1)
							.filter((i) => i.type === "question").length;

						return (
							<div key={item.data.id}>
								<SortableQuestionItem
									question={item.data}
									questionNumber={questionNumber}
									onUpdate={(updated) => updateQuestion(index, updated)}
									onRemove={() => removeItem(index)}
								/>
							</div>
						);
					})}
				</Stack>
			) : (
				// Client-side render: drag-and-drop enabled
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDragCancel={handleDragCancel}
				>
					<SortableContext
						items={flatListItems.map((item) =>
							item.type === "question" ? item.data.id : item.id,
						)}
						strategy={verticalListSortingStrategy}
					>
						<Stack gap="sm">
							{flatListItems.map((item, index) => {
								if (item.type === "pageBreak") {
									return (
										<SortablePageBreakItem
											key={item.id}
											id={item.id}
											onRemove={() => removeItem(index)}
										/>
									);
								}

								// Calculate question number (counting only questions before this item)
								const questionNumber = flatListItems
									.slice(0, index + 1)
									.filter((i) => i.type === "question").length;

								return (
									<SortableQuestionItem
										key={item.data.id}
										question={item.data}
										questionNumber={questionNumber}
										onUpdate={(updated) => updateQuestion(index, updated)}
										onRemove={() => removeItem(index)}
									/>
								);
							})}
						</Stack>
					</SortableContext>
					<DragOverlay>
						{activeItem ? (
							activeItem.type === "pageBreak" ? (
								<Paper
									withBorder
									p="sm"
									radius="md"
									style={{ cursor: "grabbing" }}
								>
									<Group justify="space-between">
										<Group gap="xs">
											<IconGripVertical size={16} />
											<IconSeparator size={20} />
											<Text size="sm" c="dimmed" fw={500}>
												Page Break
											</Text>
										</Group>
									</Group>
								</Paper>
							) : (
								<Card
									withBorder
									radius="md"
									p="md"
									style={{ cursor: "grabbing" }}
								>
									<Group justify="space-between" wrap="nowrap">
										<Group gap="xs" style={{ flex: 1 }}>
											<IconGripVertical size={16} />
											<Text fw={500} size="sm">
												Question{" "}
												{
													flatListItems
														.slice(
															0,
															flatListItems.findIndex(
																(i) =>
																	i.type === "question" &&
																	i.data.id === activeItem.data.id,
															) + 1,
														)
														.filter((i) => i.type === "question").length
												}
												:{" "}
												{activeItem.data.type === "multiple-choice"
													? "Multiple Choice"
													: activeItem.data.type === "short-answer"
														? "Short Answer"
														: "Long Answer"}
											</Text>
											{activeItem.data.prompt && (
												<Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
													{activeItem.data.prompt}
												</Text>
											)}
										</Group>
									</Group>
								</Card>
							)
						) : null}
					</DragOverlay>
				</DndContext>
			)}
		</Stack>
	);
}
