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
	Radio,
	Select,
	Stack,
	Table,
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
	ChoiceQuestion,
	FillInTheBlankQuestion,
	MultipleChoiceQuestion,
	MultipleSelectionMatrixQuestion,
	Question,
	QuestionType,
	QuizPage,
	QuizResource,
	RankingQuestion,
	SingleSelectionMatrixQuestion,
} from "server/json/raw-quiz-config.types.v2";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { parseFillInTheBlank } from "~/utils/fill-in-the-blank-utils";
import { getPath, useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";

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
	const _grading = useFormWatchForceUpdate(
		form,
		path,
		({ previousValue, value }) => {
			return previousValue?.enabled !== value?.enabled;
		},
	);
	const grading = _grading ?? {
		enabled: false,
	};

	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="sm">
				<Title order={5}>Grading Configuration</Title>
				<Checkbox
					{...form.getInputProps(`${path}.enabled`, {
						type: "checkbox",
					})}
					onChange={(e) => {
						if (_grading === undefined)
							form.setFieldValue(path, { enabled: e.currentTarget.checked });
						else form.setFieldValue(`${path}.enabled`, e.currentTarget.checked);
					}}
					key={form.key(`${path}.enabled`)}
					label="Enable Grading"
				/>

				{grading.enabled && (
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

export interface ScoringEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.pages.${number}.questions.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

export function ScoringEditor({ form, path }: ScoringEditorProps) {
	const scoring = useFormWatchForceUpdate(form, `${path}.scoring` as const);

	const scoringPath = `${path}.scoring` as const;
	const currentScoring = scoring;

	if (!currentScoring) return null;

	// Simple scoring
	if (currentScoring.type === "simple") {
		return (
			<NumberInput
				{...form.getInputProps(`${scoringPath}.points`)}
				key={form.key(`${scoringPath}.points`)}
				label="Points"
				description="Points awarded for correct answer"
				min={0}
				size="sm"
			/>
		);
	}

	// Manual scoring
	if (currentScoring.type === "manual") {
		return (
			<NumberInput
				{...form.getInputProps(`${scoringPath}.maxPoints`)}
				key={form.key(`${scoringPath}.maxPoints`)}
				label="Maximum Points"
				description="Maximum points for manual grading"
				min={0}
				size="sm"
			/>
		);
	}

	// Weighted scoring
	if (currentScoring.type === "weighted") {
		return (
			<Stack gap="sm">
				<Select
					label="Scoring Mode"
					value={currentScoring.mode}
					onChange={(val) => {
						if (val === "all-or-nothing") {
							form.setFieldValue(scoringPath, {
								type: "weighted",
								mode: "all-or-nothing",
								maxPoints: currentScoring.maxPoints,
							});
						} else if (val === "partial-with-penalty") {
							form.setFieldValue(scoringPath, {
								type: "weighted",
								mode: "partial-with-penalty",
								maxPoints: currentScoring.maxPoints,
								pointsPerCorrect: 1,
								penaltyPerIncorrect: 0.5,
							});
						} else if (val === "partial-no-penalty") {
							form.setFieldValue(scoringPath, {
								type: "weighted",
								mode: "partial-no-penalty",
								maxPoints: currentScoring.maxPoints,
								pointsPerCorrect: 1,
							});
						}
					}}
					data={[
						{ value: "all-or-nothing", label: "All or Nothing" },
						{
							value: "partial-with-penalty",
							label: "Partial Credit with Penalty",
						},
						{
							value: "partial-no-penalty",
							label: "Partial Credit without Penalty",
						},
					]}
					size="sm"
				/>
				<NumberInput
					{...form.getInputProps(`${scoringPath}.maxPoints`)}
					key={form.key(`${scoringPath}.maxPoints`)}
					label="Maximum Points"
					min={0}
					size="sm"
				/>
				{currentScoring.mode !== "all-or-nothing" && (
					<NumberInput
						{...form.getInputProps(`${scoringPath}.pointsPerCorrect`)}
						key={form.key(`${scoringPath}.pointsPerCorrect`)}
						label="Points Per Correct"
						min={0}
						size="sm"
						step={0.1}
					/>
				)}
				{currentScoring.mode === "partial-with-penalty" && (
					<NumberInput
						{...form.getInputProps(`${scoringPath}.penaltyPerIncorrect`)}
						key={form.key(`${scoringPath}.penaltyPerIncorrect`)}
						label="Penalty Per Incorrect"
						min={0}
						size="sm"
						step={0.1}
					/>
				)}
			</Stack>
		);
	}

	// Ranking scoring
	if (currentScoring.type === "ranking") {
		return (
			<Stack gap="sm">
				<Select
					label="Scoring Mode"
					value={currentScoring.mode}
					onChange={(val) => {
						if (val === "exact-order") {
							form.setFieldValue(scoringPath, {
								type: "ranking",
								mode: "exact-order",
								maxPoints: currentScoring.maxPoints,
							});
						} else if (val === "partial-order") {
							form.setFieldValue(scoringPath, {
								type: "ranking",
								mode: "partial-order",
								maxPoints: currentScoring.maxPoints,
								pointsPerCorrectPosition: 1,
							});
						}
					}}
					data={[
						{ value: "exact-order", label: "Exact Order Required" },
						{ value: "partial-order", label: "Partial Credit Per Position" },
					]}
					size="sm"
				/>
				<NumberInput
					{...form.getInputProps(`${scoringPath}.maxPoints`)}
					key={form.key(`${scoringPath}.maxPoints`)}
					label="Maximum Points"
					min={0}
					size="sm"
				/>
				{currentScoring.mode === "partial-order" && (
					<NumberInput
						{...form.getInputProps(`${scoringPath}.pointsPerCorrectPosition`)}
						key={form.key(`${scoringPath}.pointsPerCorrectPosition`)}
						label="Points Per Correct Position"
						min={0}
						size="sm"
						step={0.1}
					/>
				)}
			</Stack>
		);
	}

	// Matrix scoring
	if (currentScoring.type === "matrix") {
		return (
			<Stack gap="sm">
				<Select
					{...form.getInputProps(`${scoringPath}.mode`)}
					key={form.key(`${scoringPath}.mode`)}
					label="Scoring Mode"
					data={[
						{ value: "all-or-nothing", label: "All or Nothing (per row)" },
						{ value: "partial", label: "Partial Credit (per row)" },
					]}
					size="sm"
				/>
				<NumberInput
					{...form.getInputProps(`${scoringPath}.maxPoints`)}
					key={form.key(`${scoringPath}.maxPoints`)}
					label="Maximum Points"
					min={0}
					size="sm"
				/>
				<NumberInput
					{...form.getInputProps(`${scoringPath}.pointsPerRow`)}
					key={form.key(`${scoringPath}.pointsPerRow`)}
					label="Points Per Row"
					min={0}
					size="sm"
					step={0.1}
				/>
			</Stack>
		);
	}

	return null;
}

// ============================================================================
// MULTIPLE CHOICE EDITOR
// ============================================================================

export interface MultipleChoiceEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.pages.${number}.questions.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

export function MultipleChoiceEditor({
	form,
	path,
}: MultipleChoiceEditorProps) {
	// Watch options and correctAnswer
	const questionData = getPath(
		path,
		form.getValues(),
	) as MultipleChoiceQuestion;
	useFormWatchForceUpdate(form, `${path}.options` as const);
	useFormWatchForceUpdate(form, `${path}.correctAnswer` as const);

	const options = questionData.options;
	const optionKeys = Object.keys(options);

	const addOption = () => {
		const nextKey = String.fromCharCode(97 + optionKeys.length);
		form.setFieldValue(`${path}.options.${nextKey}` as const, "");
	};

	const removeOption = (key: string) => {
		const currentQuestion = getPath(
			path,
			form.getValues(),
		) as MultipleChoiceQuestion;
		const newOptions = { ...currentQuestion.options };
		delete newOptions[key];

		form.setFieldValue(`${path}.options` as const, newOptions);

		// Clear correctAnswer if it was the removed option
		if (currentQuestion.correctAnswer === key) {
			form.setFieldValue(`${path}.correctAnswer` as const, undefined);
		}
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
						{...form.getInputProps(`${path}.options.${key}`)}
						key={form.key(`${path}.options.${key}`)}
						placeholder={`Option ${key.toUpperCase()}`}
						style={{ flex: 1 }}
						size="sm"
					/>
					<Checkbox
						label="Correct"
						checked={questionData.correctAnswer === key}
						onChange={(e) => {
							if (questionData.correctAnswer === key) {
								return;
							}
							form.setFieldValue(
								`${path}.correctAnswer` as const,
								e.currentTarget.checked ? key : undefined,
								{ forceUpdate: false },
							);
						}}
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
// CHOICE EDITOR (Multiple Selection / Checkboxes)
// ============================================================================

export interface ChoiceEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.pages.${number}.questions.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

export function ChoiceEditor({ form, path }: ChoiceEditorProps) {
	const questionData = getPath(path, form.getValues()) as ChoiceQuestion;
	useFormWatchForceUpdate(form, `${path}.options` as const);
	useFormWatchForceUpdate(form, `${path}.correctAnswers` as const);

	const options = questionData.options;
	const optionKeys = Object.keys(options);
	const correctAnswers = questionData.correctAnswers || [];

	const addOption = () => {
		const nextKey = String.fromCharCode(97 + optionKeys.length);
		form.setFieldValue(`${path}.options.${nextKey}` as const, "");
	};

	const removeOption = (key: string) => {
		const currentQuestion = getPath(path, form.getValues()) as ChoiceQuestion;
		const newOptions = { ...currentQuestion.options };
		delete newOptions[key];

		form.setFieldValue(`${path}.options` as const, newOptions);

		// Remove from correctAnswers if present
		if (currentQuestion.correctAnswers?.includes(key)) {
			form.setFieldValue(
				`${path}.correctAnswers` as const,
				currentQuestion.correctAnswers.filter((k) => k !== key),
			);
		}
	};

	const toggleCorrectAnswer = (key: string, checked: boolean) => {
		const current = correctAnswers || [];
		if (checked) {
			form.setFieldValue(`${path}.correctAnswers` as const, [...current, key]);
		} else {
			form.setFieldValue(
				`${path}.correctAnswers` as const,
				current.filter((k) => k !== key),
			);
		}
	};

	return (
		<Stack gap="xs">
			<Group justify="space-between">
				<Text size="sm" fw={500}>
					Answer Options (Multiple Selection)
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
						{...form.getInputProps(`${path}.options.${key}`)}
						key={form.key(`${path}.options.${key}`)}
						placeholder={`Option ${key.toUpperCase()}`}
						style={{ flex: 1 }}
						size="sm"
					/>
					<Checkbox
						label="Correct"
						checked={correctAnswers.includes(key)}
						onChange={(e) => toggleCorrectAnswer(key, e.currentTarget.checked)}
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
// FILL IN THE BLANK EDITOR
// ============================================================================

export interface FillInTheBlankEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.pages.${number}.questions.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

export function FillInTheBlankEditor({
	form,
	path,
}: FillInTheBlankEditorProps) {
	const questionData = getPath(
		path,
		form.getValues(),
	) as FillInTheBlankQuestion;
	useFormWatchForceUpdate(form, `${path}.prompt` as const);
	useFormWatchForceUpdate(form, `${path}.correctAnswers` as const);

	// Parse the prompt using the utility function
	const parsed = parseFillInTheBlank(questionData.prompt || "");

	return (
		<Stack gap="sm">
			<Text size="sm" c="dimmed">
				Use <code>{"{{blank_id}}"}</code> in the prompt to mark blank positions.
				Each unique ID creates one answer field. Multiple{" "}
				<code>{"{{blank_id}}"}</code> with the same ID share the same answer.
				Blank IDs must be in <code>snake_case</code> or{" "}
				<code>CONSTANT_CASE</code>.
			</Text>

			{parsed.uniqueBlankIds.length > 0 && (
				<Text size="sm" c="dimmed">
					Currently {parsed.uniqueBlankIds.length} unique blank(s) detected.
				</Text>
			)}

			{/* Validation Errors */}
			{parsed.invalidBlankIds.length > 0 && (
				<Paper
					withBorder
					p="sm"
					radius="sm"
					bg="red.0"
					style={{ borderColor: "var(--mantine-color-red-6)" }}
				>
					<Text size="sm" c="red" fw={500} mb="xs">
						Invalid Blank IDs:
					</Text>
					<Stack gap="xs">
						{parsed.invalidBlankIds.map((id) => (
							<Text key={id} size="sm" c="red">
								<code>{`{{${id}}}`}</code> - Must be snake_case (e.g.,{" "}
								<code>capital_city</code>) or CONSTANT_CASE (e.g.,{" "}
								<code>MAX_VALUE</code>)
							</Text>
						))}
					</Stack>
				</Paper>
			)}

			{parsed.uniqueBlankIds.length > 0 && parsed.isValid && (
				<Stack gap="xs">
					<Text size="sm" fw={500}>
						Correct Answers for Each Blank
					</Text>
					{parsed.uniqueBlankIds.map((blankId) => {
						const occurrences = parsed.blankIds.filter(
							(id) => id === blankId,
						).length;
						return (
							<TextInput
								{...form.getInputProps(`${path}.correctAnswers.${blankId}`)}
								key={form.key(`${path}.correctAnswers.${blankId}`)}
								label={`Blank: ${blankId}${occurrences > 1 ? ` (used ${occurrences} times)` : ""}`}
								placeholder={`Answer for ${blankId}`}
								size="sm"
							/>
						);
					})}
				</Stack>
			)}

			{parsed.uniqueBlankIds.length === 0 && (
				<Text size="sm" c="dimmed" ta="center">
					Add {"{{blank_id}}"} markers to the prompt above
				</Text>
			)}
		</Stack>
	);
}

// ============================================================================
// RANKING EDITOR
// ============================================================================

export interface RankingEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.pages.${number}.questions.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

// Sortable Ranking Item
interface SortableRankingItemProps {
	id: string;
	label: string;
	index: number;
	onRemove: () => void;
	canRemove: boolean;
	form: UseFormReturnType<ActivityModuleFormValues>;
	path: string;
}

function SortableRankingItem({
	id,
	index,
	onRemove,
	canRemove,
	form,
	path,
}: SortableRankingItemProps) {
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
		<Group ref={setNodeRef} style={style} gap="xs" wrap="nowrap">
			<ActionIcon
				{...attributes}
				{...listeners}
				variant="subtle"
				style={{ cursor: "grab" }}
			>
				<IconGripVertical size={16} />
			</ActionIcon>
			<Text size="sm" fw={500} style={{ minWidth: 30 }}>
				#{index + 1}
			</Text>
			<TextInput
				{...form.getInputProps(`${path}.${id}`)}
				key={form.key(`${path}.${id}`)}
				placeholder={`Item ${id.toUpperCase()}`}
				style={{ flex: 1 }}
				size="sm"
			/>
			<ActionIcon
				color="red"
				variant="subtle"
				onClick={onRemove}
				disabled={!canRemove}
			>
				<IconTrash size={16} />
			</ActionIcon>
		</Group>
	);
}

export function RankingEditor({ form, path }: RankingEditorProps) {
	const mounted = useMounted();
	const questionData = getPath(path, form.getValues()) as RankingQuestion;
	useFormWatchForceUpdate(form, `${path}.items` as const);
	useFormWatchForceUpdate(form, `${path}.correctOrder` as const);

	const items = questionData.items || {};
	const itemKeys = Object.keys(items);
	const correctOrder = questionData.correctOrder || [];
	const [activeId, setActiveId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// Initialize correct order with all item keys if empty
	const orderedKeys = correctOrder.length > 0 ? correctOrder : itemKeys;

	const addItem = () => {
		const nextKey = String.fromCharCode(97 + itemKeys.length);
		form.setFieldValue(`${path}.items.${nextKey}` as const, "");
		// Add to correct order
		form.setFieldValue(`${path}.correctOrder` as const, [
			...orderedKeys,
			nextKey,
		]);
	};

	const removeItem = (key: string) => {
		const currentQuestion = getPath(path, form.getValues()) as RankingQuestion;
		const newItems = { ...currentQuestion.items };
		delete newItems[key];

		form.setFieldValue(`${path}.items` as const, newItems);

		// Remove from correctOrder
		form.setFieldValue(
			`${path}.correctOrder` as const,
			orderedKeys.filter((k) => k !== key),
		);
	};

	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			setActiveId(null);
			return;
		}

		const oldIndex = orderedKeys.indexOf(active.id as string);
		const newIndex = orderedKeys.indexOf(over.id as string);

		if (oldIndex === -1 || newIndex === -1) {
			setActiveId(null);
			return;
		}

		const newOrder = arrayMove(orderedKeys, oldIndex, newIndex);
		form.setFieldValue(`${path}.correctOrder` as const, newOrder);
		setActiveId(null);
	};

	const handleDragCancel = () => {
		setActiveId(null);
	};

	return (
		<Stack gap="xs">
			<Group justify="space-between">
				<Text size="sm" fw={500}>
					Ranking Items (Drag to set correct order)
				</Text>
				<Button
					size="compact-sm"
					variant="light"
					leftSection={<IconPlus size={14} />}
					onClick={addItem}
				>
					Add Item
				</Button>
			</Group>

			{orderedKeys.length === 0 ? (
				<Text size="sm" c="dimmed" ta="center">
					No items yet. Click "Add Item" to get started.
				</Text>
			) : !mounted ? (
				// Server-side render: static list without drag-and-drop
				<Stack gap="sm">
					{orderedKeys.map((key, index) => (
						<Group key={key} gap="xs" wrap="nowrap">
							<Text size="sm" fw={500} style={{ minWidth: 30 }}>
								#{index + 1}
							</Text>
							<TextInput
								{...form.getInputProps(`${path}.items.${key}`)}
								key={form.key(`${path}.items.${key}`)}
								placeholder={`Item ${key.toUpperCase()}`}
								style={{ flex: 1 }}
								size="sm"
							/>
							<ActionIcon
								color="red"
								variant="subtle"
								onClick={() => removeItem(key)}
								disabled={itemKeys.length <= 2}
							>
								<IconTrash size={16} />
							</ActionIcon>
						</Group>
					))}
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
						items={orderedKeys}
						strategy={verticalListSortingStrategy}
					>
						<Stack gap="sm">
							{orderedKeys.map((key, index) => (
								<SortableRankingItem
									key={key}
									id={key}
									label={items[key]}
									index={index}
									onRemove={() => removeItem(key)}
									canRemove={itemKeys.length > 2}
									form={form}
									path={`${path}.items`}
								/>
							))}
						</Stack>
					</SortableContext>
					<DragOverlay>
						{activeId && <Text>Dragging: {items[activeId]}</Text>}
					</DragOverlay>
				</DndContext>
			)}
		</Stack>
	);
}

// ============================================================================
// MATRIX EDITORS (Single & Multiple Selection)
// ============================================================================

export interface MatrixEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.pages.${number}.questions.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

export function SingleSelectionMatrixEditor({ form, path }: MatrixEditorProps) {
	const questionData = getPath(
		path,
		form.getValues(),
	) as SingleSelectionMatrixQuestion;
	useFormWatchForceUpdate(form, `${path}.rows` as const);
	useFormWatchForceUpdate(form, `${path}.columns` as const);
	useFormWatchForceUpdate(form, `${path}.correctAnswers` as const);

	const rows = questionData.rows || {};
	const columns = questionData.columns || {};
	const correctAnswers = questionData.correctAnswers || {};
	const rowKeys = Object.keys(rows);
	const columnKeys = Object.keys(columns);

	const addRow = () => {
		const nextKey = `row-${rowKeys.length + 1}`;
		form.setFieldValue(`${path}.rows.${nextKey}` as const, "");
	};

	const removeRow = (key: string) => {
		const currentQuestion = getPath(
			path,
			form.getValues(),
		) as SingleSelectionMatrixQuestion;
		const newRows = { ...currentQuestion.rows };
		delete newRows[key];
		form.setFieldValue(`${path}.rows` as const, newRows);

		// Remove from correctAnswers
		const newCorrectAnswers = { ...currentQuestion.correctAnswers };
		delete newCorrectAnswers[key];
		form.setFieldValue(`${path}.correctAnswers` as const, newCorrectAnswers);
	};

	const addColumn = () => {
		const nextKey = `col-${columnKeys.length + 1}`;
		form.setFieldValue(`${path}.columns.${nextKey}` as const, "");
	};

	const removeColumn = (key: string) => {
		const currentQuestion = getPath(
			path,
			form.getValues(),
		) as SingleSelectionMatrixQuestion;
		const newColumns = { ...currentQuestion.columns };
		delete newColumns[key];
		form.setFieldValue(`${path}.columns` as const, newColumns);

		// Update correctAnswers to remove this column
		const newCorrectAnswers = { ...currentQuestion.correctAnswers };
		for (const rowKey in newCorrectAnswers) {
			if (newCorrectAnswers[rowKey] === key) {
				delete newCorrectAnswers[rowKey];
			}
		}
		form.setFieldValue(`${path}.correctAnswers` as const, newCorrectAnswers);
	};

	const setCorrectAnswer = (rowKey: string, columnKey: string) => {
		form.setFieldValue(`${path}.correctAnswers.${rowKey}` as const, columnKey);
	};

	return (
		<Stack gap="md">
			<Stack gap="xs">
				<Group justify="space-between">
					<Text size="sm" fw={500}>
						Rows
					</Text>
					<Button
						size="compact-sm"
						variant="light"
						leftSection={<IconPlus size={14} />}
						onClick={addRow}
					>
						Add Row
					</Button>
				</Group>
				{rowKeys.map((key) => (
					<Group key={key} gap="xs" wrap="nowrap">
						<TextInput
							{...form.getInputProps(`${path}.rows.${key}`)}
							key={form.key(`${path}.rows.${key}`)}
							placeholder="Row label"
							style={{ flex: 1 }}
							size="sm"
						/>
						<ActionIcon
							color="red"
							variant="subtle"
							onClick={() => removeRow(key)}
							disabled={rowKeys.length <= 1}
						>
							<IconTrash size={16} />
						</ActionIcon>
					</Group>
				))}
			</Stack>

			<Stack gap="xs">
				<Group justify="space-between">
					<Text size="sm" fw={500}>
						Columns
					</Text>
					<Button
						size="compact-sm"
						variant="light"
						leftSection={<IconPlus size={14} />}
						onClick={addColumn}
					>
						Add Column
					</Button>
				</Group>
				{columnKeys.map((key) => (
					<Group key={key} gap="xs" wrap="nowrap">
						<TextInput
							{...form.getInputProps(`${path}.columns.${key}`)}
							key={form.key(`${path}.columns.${key}`)}
							placeholder="Column label"
							style={{ flex: 1 }}
							size="sm"
						/>
						<ActionIcon
							color="red"
							variant="subtle"
							onClick={() => removeColumn(key)}
							disabled={columnKeys.length <= 1}
						>
							<IconTrash size={16} />
						</ActionIcon>
					</Group>
				))}
			</Stack>

			{rowKeys.length > 0 && columnKeys.length > 0 && (
				<Stack gap="xs">
					<Text size="sm" fw={500}>
						Matrix Preview & Correct Answers
					</Text>
					<Table striped highlightOnHover withTableBorder>
						<Table.Thead>
							<Table.Tr>
								<Table.Th />
								{columnKeys.map((colKey) => (
									<Table.Th key={colKey}>{columns[colKey] || colKey}</Table.Th>
								))}
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{rowKeys.map((rowKey) => (
								<Table.Tr key={rowKey}>
									<Table.Td fw={500}>{rows[rowKey] || rowKey}</Table.Td>
									{columnKeys.map((colKey) => (
										<Table.Td key={`${rowKey}-${colKey}`}>
											<Radio
												checked={correctAnswers[rowKey] === colKey}
												onChange={() => setCorrectAnswer(rowKey, colKey)}
											/>
										</Table.Td>
									))}
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</Stack>
			)}
		</Stack>
	);
}

export function MultipleSelectionMatrixEditor({
	form,
	path,
}: MatrixEditorProps) {
	const questionData = getPath(
		path,
		form.getValues(),
	) as MultipleSelectionMatrixQuestion;
	useFormWatchForceUpdate(form, `${path}.rows` as const);
	useFormWatchForceUpdate(form, `${path}.columns` as const);
	useFormWatchForceUpdate(form, `${path}.correctAnswers` as const);

	const rows = questionData.rows || {};
	const columns = questionData.columns || {};
	const correctAnswers = questionData.correctAnswers || {};
	const rowKeys = Object.keys(rows);
	const columnKeys = Object.keys(columns);

	const addRow = () => {
		const nextKey = `row-${rowKeys.length + 1}`;
		form.setFieldValue(`${path}.rows.${nextKey}` as const, "");
	};

	const removeRow = (key: string) => {
		const currentQuestion = getPath(
			path,
			form.getValues(),
		) as MultipleSelectionMatrixQuestion;
		const newRows = { ...currentQuestion.rows };
		delete newRows[key];
		form.setFieldValue(`${path}.rows` as const, newRows);

		// Remove from correctAnswers
		const newCorrectAnswers = { ...currentQuestion.correctAnswers };
		delete newCorrectAnswers[key];
		form.setFieldValue(`${path}.correctAnswers` as const, newCorrectAnswers);
	};

	const addColumn = () => {
		const nextKey = `col-${columnKeys.length + 1}`;
		form.setFieldValue(`${path}.columns.${nextKey}` as const, "");
	};

	const removeColumn = (key: string) => {
		const currentQuestion = getPath(
			path,
			form.getValues(),
		) as MultipleSelectionMatrixQuestion;
		const newColumns = { ...currentQuestion.columns };
		delete newColumns[key];
		form.setFieldValue(`${path}.columns` as const, newColumns);

		// Update correctAnswers to remove this column
		const newCorrectAnswers = { ...currentQuestion.correctAnswers };
		for (const rowKey in newCorrectAnswers) {
			if (newCorrectAnswers[rowKey] === key) {
				delete newCorrectAnswers[rowKey];
			}
		}
		form.setFieldValue(`${path}.correctAnswers` as const, newCorrectAnswers);
	};

	const setCorrectAnswer = (rowKey: string, selectedValue: string | null) => {
		if (selectedValue) {
			form.setFieldValue(
				`${path}.correctAnswers.${rowKey}` as const,
				selectedValue,
			);
		} else {
			const currentQuestion = getPath(
				path,
				form.getValues(),
			) as MultipleSelectionMatrixQuestion;
			const newCorrectAnswers = { ...currentQuestion.correctAnswers };
			delete newCorrectAnswers[rowKey];
			form.setFieldValue(`${path}.correctAnswers` as const, newCorrectAnswers);
		}
	};

	// Convert columns object to Mantine Select data format
	const columnData = columnKeys.map((key) => ({
		value: key,
		label: columns[key] || key,
	}));

	return (
		<Stack gap="md">
			<Stack gap="xs">
				<Group justify="space-between">
					<Text size="sm" fw={500}>
						Rows
					</Text>
					<Button
						size="compact-sm"
						variant="light"
						leftSection={<IconPlus size={14} />}
						onClick={addRow}
					>
						Add Row
					</Button>
				</Group>
				{rowKeys.map((key) => (
					<Group key={key} gap="xs" wrap="nowrap">
						<TextInput
							{...form.getInputProps(`${path}.rows.${key}`)}
							key={form.key(`${path}.rows.${key}`)}
							placeholder="Row label"
							style={{ flex: 1 }}
							size="sm"
						/>
						<ActionIcon
							color="red"
							variant="subtle"
							onClick={() => removeRow(key)}
							disabled={rowKeys.length <= 1}
						>
							<IconTrash size={16} />
						</ActionIcon>
					</Group>
				))}
			</Stack>

			<Stack gap="xs">
				<Group justify="space-between">
					<Text size="sm" fw={500}>
						Columns
					</Text>
					<Button
						size="compact-sm"
						variant="light"
						leftSection={<IconPlus size={14} />}
						onClick={addColumn}
					>
						Add Column
					</Button>
				</Group>
				{columnKeys.map((key) => (
					<Group key={key} gap="xs" wrap="nowrap">
						<TextInput
							{...form.getInputProps(`${path}.columns.${key}`)}
							key={form.key(`${path}.columns.${key}`)}
							placeholder="Column label"
							style={{ flex: 1 }}
							size="sm"
						/>
						<ActionIcon
							color="red"
							variant="subtle"
							onClick={() => removeColumn(key)}
							disabled={columnKeys.length <= 1}
						>
							<IconTrash size={16} />
						</ActionIcon>
					</Group>
				))}
			</Stack>

			{rowKeys.length > 0 && columnKeys.length > 0 && (
				<Stack gap="xs">
					<Text size="sm" fw={500}>
						Matrix Preview & Correct Answers
					</Text>
					<Table striped highlightOnHover withTableBorder>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Question</Table.Th>
								<Table.Th>Answer</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{rowKeys.map((rowKey) => (
								<Table.Tr key={rowKey}>
									<Table.Td fw={500}>{rows[rowKey] || rowKey}</Table.Td>
									<Table.Td>
										<Select
											value={correctAnswers[rowKey] || null}
											onChange={(val) => setCorrectAnswer(rowKey, val)}
											data={columnData}
											placeholder="Select correct answer"
											clearable
											size="sm"
										/>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</Stack>
			)}
		</Stack>
	);
}

// ============================================================================
// RESOURCE EDITOR
// ============================================================================

export interface ResourceEditorProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.resources.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.resources.${number}`;
	resourceNumber: number;
	availablePages: Array<{ id: string; title: string }>;
	onRemove: () => void;
}

export function ResourceEditor({
	form,
	path,
	resourceNumber,
	availablePages,
	onRemove,
}: ResourceEditorProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	// Watch resource data
	const resourceTitle = useFormWatchForceUpdate(form, `${path}.title` as const);
	const resourcePages = useFormWatchForceUpdate(form, `${path}.pages` as const);
	const resourceContent = useFormWatchForceUpdate(
		form,
		`${path}.content` as const,
	);

	const resource = {
		title: resourceTitle,
		pages: resourcePages || [],
		content: resourceContent || "",
	};

	// Handle page checkbox changes
	const togglePage = (pageId: string, checked: boolean) => {
		const currentPages = resource.pages || [];
		if (checked) {
			form.setFieldValue(`${path}.pages` as const, [...currentPages, pageId]);
		} else {
			form.setFieldValue(
				`${path}.pages` as const,
				currentPages.filter((id) => id !== pageId),
			);
		}
	};

	return (
		<Card withBorder radius="md" p="md">
			<Stack gap="sm">
				{/* Header with collapse button and delete button */}
				<Group justify="space-between" wrap="nowrap">
					<Group gap="xs" style={{ flex: 1 }}>
						<Text fw={500} size="sm">
							Resource {resourceNumber}
						</Text>
						{!isExpanded && resource.title && (
							<Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
								{resource.title}
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
						<TextInput
							{...form.getInputProps(`${path}.title`)}
							key={form.key(`${path}.title`)}
							label="Resource Title (optional)"
							placeholder="e.g., Reference Material"
							size="sm"
						/>

						<Box>
							<Text size="sm" fw={500} mb="xs">
								Content
							</Text>
							<SimpleRichTextEditor
								content={resource.content}
								onChange={(content) => {
									form.setFieldValue(`${path}.content` as const, content);
								}}
								placeholder="Enter resource content..."
							/>
						</Box>

						<Box>
							<Text size="sm" fw={500} mb="xs">
								Display on Pages
							</Text>
							<Text size="xs" c="dimmed" mb="sm">
								Select which pages this resource should be visible on
							</Text>
							{availablePages.length === 0 ? (
								<Text size="sm" c="dimmed" ta="center" py="md">
									No pages available. Add questions to create pages.
								</Text>
							) : (
								<Stack gap="xs">
									{availablePages.map((page, index) => (
										<Checkbox
											key={page.id}
											label={`Page ${index + 1}: ${page.title}`}
											checked={resource.pages.includes(page.id)}
											onChange={(e) =>
												togglePage(page.id, e.currentTarget.checked)
											}
										/>
									))}
								</Stack>
							)}
						</Box>
					</Stack>
				)}
			</Stack>
		</Card>
	);
}

// ============================================================================
// RESOURCES LIST
// ============================================================================

export interface ResourcesListProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| "rawQuizConfig.resources"
		| `rawQuizConfig.nestedQuizzes.${number}.resources`;
	pagesPath:
		| "rawQuizConfig.pages"
		| `rawQuizConfig.nestedQuizzes.${number}.pages`;
}

export function ResourcesList({ form, path, pagesPath }: ResourcesListProps) {
	// Watch resources and pages
	const resources =
		useFormWatchForceUpdate(form, path, ({ previousValue, value }) => {
			const oldResources = (previousValue || []).map((r) => ({
				id: r.id,
				title: r.title,
			}));
			const newResources = (value || []).map((r) => ({
				id: r.id,
				title: r.title,
			}));
			return JSON.stringify(oldResources) !== JSON.stringify(newResources);
		}) || [];

	const pages = useFormWatchForceUpdate(
		form,
		pagesPath,
		({ previousValue, value }) => {
			const oldPages = previousValue.map((p) => ({ id: p.id, title: p.title }));
			const newPages = value.map((p) => ({ id: p.id, title: p.title }));
			return JSON.stringify(oldPages) !== JSON.stringify(newPages);
		},
	);

	// Helper to get available pages as { id, title }[]
	const availablePages = pages.map((p) => ({ id: p.id, title: p.title }));

	// Add resource handler
	const addResource = () => {
		const currentResources = getPath(path, form.getValues()) || [];
		const newResource: QuizResource = {
			id: `resource-${Date.now()}`,
			title: "",
			content: "",
			pages: [],
		};
		form.setFieldValue(path, [...currentResources, newResource]);
	};

	// Remove resource handler
	const removeResource = (index: number) => {
		const currentResources = getPath(path, form.getValues()) || [];
		form.setFieldValue(
			path,
			currentResources.filter((_, i) => i !== index),
		);
	};

	return (
		<Stack gap="md">
			<Group>
				<Button leftSection={<IconPlus size={16} />} onClick={addResource}>
					Add Resource
				</Button>
			</Group>

			{resources.length === 0 ? (
				<Paper withBorder p="xl" radius="md">
					<Text ta="center" c="dimmed">
						No resources yet. Click "Add Resource" to get started.
					</Text>
				</Paper>
			) : (
				<Stack gap="sm">
					{resources.map((resource, index) => {
						const resourcePath = `${path}.${index}` as
							| `rawQuizConfig.resources.${number}`
							| `rawQuizConfig.nestedQuizzes.${number}.resources.${number}`;
						return (
							<ResourceEditor
								key={resource.id}
								form={form}
								path={resourcePath}
								resourceNumber={index + 1}
								availablePages={availablePages}
								onRemove={() => removeResource(index)}
							/>
						);
					})}
				</Stack>
			)}
		</Stack>
	);
}

// ============================================================================
// SORTABLE PAGE BREAK ITEM
// ============================================================================

export interface SortablePageBreakItemProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	basePath:
		| "rawQuizConfig.pages"
		| `rawQuizConfig.nestedQuizzes.${number}.pages`;
	id: string; // Format: "pageBreak-{pageId}"
	pageNumber: number;
}

export function SortablePageBreakItem({
	form,
	basePath,
	id,
	pageNumber,
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

	const handleRemove = () => {
		const currentPages = getPath(basePath, form.getValues()) || [];
		if (currentPages.length <= 1) return; // Don't remove the last page

		// Extract page ID from id prop
		const pageId = id.replace("pageBreak-", "");
		const pageIndex = currentPages.findIndex((p) => p.id === pageId);

		if (pageIndex === -1 || pageIndex === 0) return; // Don't remove page 0

		// we get the question in this page and move them to previous page
		const questions = currentPages[pageIndex].questions;
		const previousPage = currentPages[pageIndex - 1];
		const updatedQuestions = [...previousPage.questions, ...questions];
		previousPage.questions = updatedQuestions;
		const updatedPages = currentPages.filter((_, index) => index !== pageIndex);
		form.setFieldValue(basePath, updatedPages);
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
							Page Break {pageNumber}
						</Text>
					</Group>
					<ActionIcon color="red" variant="subtle" onClick={handleRemove}>
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
	form: UseFormReturnType<ActivityModuleFormValues>;
	path:
		| `rawQuizConfig.pages.${number}.questions.${number}`
		| `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
	questionNumber: number;
	pageNumber: number;
}

export function SortableQuestionItem({
	form,
	path,
	questionNumber,
	pageNumber,
}: SortableQuestionItemProps) {
	const parts = path.split(".");
	const pageIndex = Number.parseInt(parts[parts.indexOf("pages") + 1]);
	const questionIndex = Number.parseInt(parts[parts.indexOf("questions") + 1]);
	const pagesPath = parts.slice(0, parts.indexOf("pages") + 1).join(".") as
		| `rawQuizConfig.pages`
		| `rawQuizConfig.nestedQuizzes.${number}.pages`;
	const [isExpanded, setIsExpanded] = useState(false);

	// Get the question from form state
	const questionId = useFormWatchForceUpdate(form, `${path}.id` as const);
	const questionPrompt = useFormWatchForceUpdate(
		form,
		`${path}.prompt` as const,
	);
	const questionType = useFormWatchForceUpdate(form, `${path}.type` as const);

	const question = {
		id: questionId,
		prompt: questionPrompt,
		type: questionType,
	};

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: questionId });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.3 : 1,
	};

	const updateQuestion = (updated: Question) => {
		form.setFieldValue(path, updated);
	};

	const handleRemove = () => {
		// Parse path to extract pageIndex and questionIndex
		// Path format: "rawQuizConfig.pages.{pageIndex}.questions.{questionIndex}"
		// or "rawQuizConfig.nestedQuizzes.{nestedIndex}.pages.{pageIndex}.questions.{questionIndex}"

		const currentPages = getPath(pagesPath, form.getValues());
		const updatedPages = [...currentPages];
		const updatedQuestions = [...updatedPages[pageIndex].questions];
		updatedQuestions.splice(questionIndex, 1);

		updatedPages[pageIndex] = {
			...updatedPages[pageIndex],
			questions: updatedQuestions,
		};

		form.setFieldValue(pagesPath, updatedPages);
	};

	const renderQuestionTypeFields = () => {
		switch (question.type) {
			case "multiple-choice":
				return <MultipleChoiceEditor form={form} path={path} />;

			case "choice":
				return <ChoiceEditor form={form} path={path} />;

			case "short-answer":
				return (
					<TextInput
						{...form.getInputProps(`${path}.correctAnswer`)}
						key={form.key(`${path}.correctAnswer`)}
						label="Correct Answer (optional)"
						description="For automatic grading (exact match)"
						size="sm"
					/>
				);

			case "long-answer":
				return (
					<Textarea
						{...form.getInputProps(`${path}.correctAnswer`)}
						key={form.key(`${path}.correctAnswer`)}
						label="Sample/Expected Answer (optional)"
						description="For reference purposes (requires manual grading)"
						minRows={3}
						size="sm"
					/>
				);

			case "article":
				return (
					<Text size="sm" c="dimmed">
						Article type uses rich text editor for student responses. No answer
						configuration needed.
					</Text>
				);

			case "fill-in-the-blank":
				return <FillInTheBlankEditor form={form} path={path} />;

			case "ranking":
				return <RankingEditor form={form} path={path} />;

			case "single-selection-matrix":
				return <SingleSelectionMatrixEditor form={form} path={path} />;

			case "multiple-selection-matrix":
				return <MultipleSelectionMatrixEditor form={form} path={path} />;

			case "whiteboard":
				return (
					<Text size="sm" c="dimmed">
						Whiteboard type uses Excalidraw canvas for drawing. No answer
						configuration needed.
					</Text>
				);

			default:
				return <Text c="dimmed">Question type not yet implemented</Text>;
		}
	};

	const getQuestionTypeLabel = (type: QuestionType): string => {
		const labels: Record<QuestionType, string> = {
			"multiple-choice": "Multiple Choice",
			"short-answer": "Short Answer",
			"long-answer": "Long Answer",
			article: "Article",
			"fill-in-the-blank": "Fill in the Blank",
			choice: "Choice (Multiple Selection)",
			ranking: "Ranking",
			"single-selection-matrix": "Single Selection Matrix",
			"multiple-selection-matrix": "Multiple Selection Matrix",
			whiteboard: "Whiteboard",
		};
		return labels[type];
	};

	const questionTypeLabel = getQuestionTypeLabel(question.type);

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
								Question {questionNumber} (Page {pageNumber}):{" "}
								{questionTypeLabel}
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
							<ActionIcon color="red" variant="subtle" onClick={handleRemove}>
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
										type: val as Question["type"],
									};

									if (val === "multiple-choice") {
										updateQuestion({
											...baseQuestion,
											type: "multiple-choice",
											options: { a: "Option A", b: "Option B" },
											correctAnswer: "a",
											scoring: { type: "simple", points: 1 },
										});
									} else if (val === "choice") {
										updateQuestion({
											...baseQuestion,
											type: "choice",
											options: { a: "Option A", b: "Option B" },
											correctAnswers: [],
											scoring: {
												type: "weighted",
												mode: "all-or-nothing",
												maxPoints: 1,
											},
										});
									} else if (val === "short-answer") {
										updateQuestion({
											...baseQuestion,
											type: "short-answer",
											correctAnswer: "",
											scoring: { type: "simple", points: 1 },
										});
									} else if (val === "long-answer") {
										updateQuestion({
											...baseQuestion,
											type: "long-answer",
											correctAnswer: "",
											scoring: { type: "manual", maxPoints: 1 },
										});
									} else if (val === "article") {
										updateQuestion({
											...baseQuestion,
											type: "article",
											scoring: { type: "manual", maxPoints: 1 },
										});
									} else if (val === "fill-in-the-blank") {
										updateQuestion({
											...baseQuestion,
											type: "fill-in-the-blank",
											correctAnswers: {},
											scoring: {
												type: "weighted",
												mode: "partial-no-penalty",
												maxPoints: 1,
												pointsPerCorrect: 1,
											},
										});
									} else if (val === "ranking") {
										updateQuestion({
											...baseQuestion,
											type: "ranking",
											items: { a: "Item A", b: "Item B" },
											correctOrder: [],
											scoring: {
												type: "ranking",
												mode: "exact-order",
												maxPoints: 1,
											},
										});
									} else if (val === "single-selection-matrix") {
										updateQuestion({
											...baseQuestion,
											type: "single-selection-matrix",
											rows: { "row-1": "Row 1" },
											columns: { "col-1": "Column 1", "col-2": "Column 2" },
											correctAnswers: {},
											scoring: {
												type: "matrix",
												maxPoints: 1,
												pointsPerRow: 1,
												mode: "partial",
											},
										});
									} else if (val === "multiple-selection-matrix") {
										updateQuestion({
											...baseQuestion,
											type: "multiple-selection-matrix",
											rows: { "row-1": "Row 1" },
											columns: { "col-1": "Column 1", "col-2": "Column 2" },
											correctAnswers: {},
											scoring: {
												type: "matrix",
												maxPoints: 1,
												pointsPerRow: 1,
												mode: "partial",
											},
										});
									} else if (val === "whiteboard") {
										updateQuestion({
											...baseQuestion,
											type: "whiteboard",
											scoring: { type: "manual", maxPoints: 1 },
										});
									}
								}}
								data={[
									{ value: "multiple-choice", label: "Multiple Choice" },
									{ value: "choice", label: "Choice (Multiple Selection)" },
									{ value: "short-answer", label: "Short Answer" },
									{ value: "long-answer", label: "Long Answer" },
									{ value: "article", label: "Article" },
									{ value: "fill-in-the-blank", label: "Fill in the Blank" },
									{ value: "ranking", label: "Ranking" },
									{
										value: "single-selection-matrix",
										label: "Single Selection Matrix",
									},
									{
										value: "multiple-selection-matrix",
										label: "Multiple Selection Matrix",
									},
									{ value: "whiteboard", label: "Whiteboard" },
								]}
								size="sm"
							/>

							<Textarea
								{...form.getInputProps(`${path}.prompt`)}
								key={form.key(`${path}.prompt`)}
								label="Question Prompt"
								minRows={2}
								required
								size="sm"
							/>

							{renderQuestionTypeFields()}

							<Textarea
								{...form.getInputProps(`${path}.feedback`)}
								key={form.key(`${path}.feedback`)}
								label="Feedback (optional)"
								description="Shown to students after answering"
								minRows={2}
								size="sm"
							/>

							<ScoringEditor form={form} path={path} />
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

	// Watch pages - only need IDs for performance
	const pagesData = useFormWatchForceUpdate(
		form,
		path,
		({ previousValue, value }) => {
			const oldPages = previousValue.map((page) => ({
				id: page.id,
				title: page.title,
				questionIds: page.questions.map((q) => q.id),
			}));
			const newPages = value.map((page) => ({
				id: page.id,
				title: page.title,
				questionIds: page.questions.map((q) => q.id),
			}));
			return JSON.stringify(oldPages) !== JSON.stringify(newPages);
		},
	);

	// Flatten pages and questions as a list of { type: "page" | "question", id: string, pageIndex?: number, questionIndex?: number }
	const flatListItems: Array<
		| { type: "page"; id: string; pageIndex: number }
		| { type: "question"; id: string; pageIndex: number; questionIndex: number }
	> = [];
	// pagesData.forEach((page, pageIdx) => {
	//     page.questionIds.forEach((qId, qIdx) => {
	//         flatListItems.push({
	//             type: "question",
	//             id: qId,
	//             pageIndex: pageIdx,
	//             questionIndex: qIdx,
	//         });
	//     });
	//     if (pageIdx > 0)
	//         flatListItems.push({ type: "page", id: page.id, pageIndex: pageIdx });
	// });
	for (let i = 0; i < pagesData.length; i++) {
		const page = pagesData[i];
		if (i > 0) {
			flatListItems.push({ type: "page", id: page.id, pageIndex: i });
		}
		for (let j = 0; j < page.questions.length; j++) {
			flatListItems.push({
				type: "question",
				id: page.questions[j].id,
				pageIndex: i,
				questionIndex: j,
			});
		}
	}

	const totalQuestions = flatListItems.filter(
		(item) => item.type === "question",
	).length;
	const sortableIds = flatListItems.map((item) => item.id);

	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			setActiveId(null);
			return;
		}

		const oldIndex = sortableIds.indexOf(active.id as string);
		const newIndex = sortableIds.indexOf(over.id as string);

		if (oldIndex === -1 || newIndex === -1) {
			setActiveId(null);
			return;
		}

		// Step 1: Get current pages and build question ID map
		const currentPages = getPath(path, form.getValues()) as QuizPage[];

		// Build a map of question ID -> full question object
		const questionMap = new Map<string, Question>();
		currentPages.forEach((page) => {
			page.questions.forEach((question) => {
				questionMap.set(question.id, question);
			});
		});

		// Build a map of page ID -> page data
		const pageMap = new Map<string, { id: string; title: string }>();
		currentPages.forEach((page) => {
			pageMap.set(page.id, { id: page.id, title: page.title });
		});

		// Step 2: Reorder flat list
		const reorderedFlatList = arrayMove(flatListItems, oldIndex, newIndex);

		// Step 3: Reconstruct pages from reordered flat list
		const newPages: QuizPage[] = [];
		// add the first page
		newPages.push({
			id: currentPages[0].id,
			title: currentPages[0].title,
			questions: [],
		});
		// loop through reordered flat list and add the questions or pages
		let currentPage = 0;
		for (let i = 0; i < reorderedFlatList.length; i++) {
			const item = reorderedFlatList[i];
			if (item.type === "question") {
				const question = questionMap.get(item.id);
				if (question) {
					newPages[currentPage].questions.push(question);
				}
			} else if (item.type === "page") {
				const page = pageMap.get(item.id);
				if (page) {
					newPages.push({
						id: page.id,
						title: page.title,
						questions: [],
					});
					currentPage++;
				}
			}
		}

		console.log("new pages", newPages);
		// update the form
		form.setFieldValue(path, newPages);
		setActiveId(null);
	};

	const handleDragCancel = () => {
		setActiveId(null);
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
		const currentPages = (getPath(path, form.getValues()) as QuizPage[]) || [];
		if (currentPages.length === 0) return;

		const newPage: QuizPage = {
			id: `page-${Date.now()}`,
			title: `Page ${currentPages.length + 1}`,
			questions: [],
		};

		form.setFieldValue(path, [...currentPages, newPage]);
	};

	// Render helper - generates questions and page breaks from flat list
	const renderContent = () => {
		let questionNumber = 0;

		return flatListItems.map((item) => {
			if (item.type === "page") {
				return (
					<SortablePageBreakItem
						key={item.id}
						form={form}
						basePath={path}
						id={item.id}
						pageNumber={item.pageIndex}
					/>
				);
			}

			// Question item
			questionNumber++;
			const questionPath =
				`${path}.${item.pageIndex}.questions.${item.questionIndex}` as const;

			return (
				<SortableQuestionItem
					key={item.id}
					form={form}
					path={questionPath}
					questionNumber={questionNumber}
					pageNumber={item.pageIndex + 1}
				/>
			);
		});
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

			{totalQuestions === 0 ? (
				<Paper withBorder p="xl" radius="md">
					<Text ta="center" c="dimmed">
						No questions yet. Click "Add Question" to get started.
					</Text>
				</Paper>
			) : !mounted ? (
				// Server-side render: static list without drag-and-drop
				<Stack gap="sm">{renderContent()}</Stack>
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
						items={sortableIds}
						strategy={verticalListSortingStrategy}
					>
						<Stack gap="sm">{renderContent()}</Stack>
					</SortableContext>
					<DragOverlay>
						{activeId && <div>Dragging: {activeId}</div>}
					</DragOverlay>
				</DndContext>
			)}
			<Group>
				<Button
					leftSection={<IconPlus size={16} />}
					onClick={addQuestion}
					size="compact-xs"
				>
					Add Question
				</Button>
				<Button
					leftSection={<IconSeparator size={16} />}
					variant="light"
					onClick={addPageBreak}
					size="compact-xs"
				>
					Add Page Break
				</Button>
			</Group>
		</Stack>
	);
}
