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
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import {
	ActionIcon,
	Box,
	Checkbox,
	Group,
	Loader,
	Radio,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
	Tooltip,
	useMantineColorScheme,
} from "@mantine/core";
import {
	useDebouncedCallback,
	useFullscreen,
	useMounted,
} from "@mantine/hooks";
import {
	IconGripVertical,
	IconMaximize,
	IconMinimize,
} from "@tabler/icons-react";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import type {
	ArticleQuestion,
	ChoiceQuestion,
	FillInTheBlankQuestion,
	LongAnswerQuestion,
	MultipleChoiceQuestion,
	MultipleSelectionMatrixQuestion,
	Question,
	RankingQuestion,
	ShortAnswerQuestion,
	SingleSelectionMatrixQuestion,
	WhiteboardQuestion,
} from "server/json/raw-quiz-config/types.v2";
import { splitPromptIntoParts } from "~/utils/fill-in-the-blank-utils";
import { useWhiteboardData } from "../activity-module-forms/use-whiteboard-data";
import { SimpleRichTextEditor } from "../rich-text/simple-rich-text-editor";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
	import("@excalidraw/excalidraw").then((module) => ({
		default: module.Excalidraw,
	})),
);

interface QuestionRendererProps {
	question: Question;
	value: unknown;
	onChange: (value: unknown) => void;
	showFeedback?: boolean;
	disabled?: boolean;
}

export function QuestionRenderer({
	question,
	value,
	onChange,
	showFeedback = false,
	disabled = false,
}: QuestionRendererProps) {
	switch (question.type) {
		case "multiple-choice":
			return (
				<MultipleChoiceRenderer
					question={question}
					value={value as string}
					onChange={onChange as (value: string) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "short-answer":
			return (
				<ShortAnswerRenderer
					question={question}
					value={value as string}
					onChange={onChange as (value: string) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "long-answer":
			return (
				<LongAnswerRenderer
					question={question}
					value={value as string}
					onChange={onChange as (value: string) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "article":
			return (
				<ArticleRenderer
					question={question}
					value={value as string}
					onChange={onChange as (value: string) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "fill-in-the-blank":
			return (
				<FillInTheBlankRenderer
					question={question}
					value={value as Record<string, string>}
					onChange={onChange as (value: Record<string, string>) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "choice":
			return (
				<ChoiceRenderer
					question={question}
					value={value as string[]}
					onChange={onChange as (value: string[]) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "ranking":
			return (
				<RankingRenderer
					question={question}
					value={value as string[]}
					onChange={onChange as (value: string[]) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "single-selection-matrix":
			return (
				<SingleSelectionMatrixRenderer
					question={question}
					value={value as Record<string, string>}
					onChange={onChange as (value: Record<string, string>) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "multiple-selection-matrix":
			return (
				<MultipleSelectionMatrixRenderer
					question={question}
					value={value as Record<string, string>}
					onChange={onChange as (value: Record<string, string>) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		case "whiteboard":
			return (
				<WhiteboardRenderer
					question={question}
					value={value as string}
					onChange={onChange as (value: string) => void}
					showFeedback={showFeedback}
					disabled={disabled}
				/>
			);
		default:
			return <Text c="red">Unknown question type</Text>;
	}
}

// Multiple Choice Renderer
function MultipleChoiceRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: MultipleChoiceQuestion;
	value: string;
	onChange: (value: string) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	return (
		<Stack gap="sm">
			<Radio.Group value={value || ""} onChange={onChange}>
				<Stack gap="xs">
					{Object.entries(question.options).map(([key, label]) => (
						<Radio key={key} value={key} label={label} disabled={disabled} />
					))}
				</Stack>
			</Radio.Group>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Short Answer Renderer
function ShortAnswerRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: ShortAnswerQuestion;
	value: string;
	onChange: (value: string) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	return (
		<Stack gap="sm">
			<TextInput
				value={value || ""}
				onChange={(e) => onChange(e.currentTarget.value)}
				placeholder="Enter your answer"
				disabled={disabled}
			/>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Long Answer Renderer
function LongAnswerRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: LongAnswerQuestion;
	value: string;
	onChange: (value: string) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	return (
		<Stack gap="sm">
			<Textarea
				value={value || ""}
				onChange={(e) => onChange(e.currentTarget.value)}
				placeholder="Enter your answer"
				minRows={4}
				disabled={disabled}
			/>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Article Renderer
function ArticleRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: ArticleQuestion;
	value: string;
	onChange: (value: string) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	return (
		<Stack gap="sm">
			<SimpleRichTextEditor
				content={value || ""}
				onChange={onChange}
				placeholder="Write your article here..."
				readonly={disabled}
			/>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Fill in the Blank Renderer
function FillInTheBlankRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: FillInTheBlankQuestion;
	value: Record<string, string>;
	onChange: (value: Record<string, string>) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	// Initialize answers object if not present
	const answers = value || {};

	const handleBlankChange = (blankId: string, blankValue: string) => {
		onChange({
			...answers,
			[blankId]: blankValue,
		});
	};

	// Parse the prompt using the utility function

	const parts = splitPromptIntoParts(question.prompt);

	return (
		<Stack gap="sm">
			<Group gap="xs" style={{ flexWrap: "wrap", alignItems: "center" }}>
				{parts.map((part, partIndex) => {
					if (part.type === "blank") {
						const blankId = part.content;

						return (
							<TextInput
								key={`${question.id}-blank-${partIndex}-${blankId}`}
								value={answers[blankId] || ""}
								onChange={(e) =>
									handleBlankChange(blankId, e.currentTarget.value)
								}
								placeholder={blankId}
								style={{ width: 150 }}
								disabled={disabled}
							/>
						);
					}

					// Regular text part
					if (part.content) {
						return (
							<Text key={`${question.id}-text-${partIndex}`} span>
								{part.content}
							</Text>
						);
					}
					return null;
				})}
			</Group>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Choice Renderer (Multiple Selection with Checkboxes)
function ChoiceRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: ChoiceQuestion;
	value: string[];
	onChange: (value: string[]) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	return (
		<Stack gap="sm">
			<Checkbox.Group value={value || []} onChange={onChange}>
				<Stack gap="xs">
					{Object.entries(question.options).map(([key, label]) => (
						<Checkbox key={key} value={key} label={label} disabled={disabled} />
					))}
				</Stack>
			</Checkbox.Group>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Sortable Item for Ranking
function SortableItem({
	id,
	item,
	index,
	disabled,
}: {
	id: string;
	item: string;
	index: number;
	disabled: boolean;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id, disabled });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.3 : 1,
	};

	return (
		<Group
			ref={setNodeRef}
			gap="sm"
			p="sm"
			style={{
				...style,
				backgroundColor: "var(--mantine-color-default)",
				border: "1px solid var(--mantine-color-default-border)",
				borderRadius: "var(--mantine-radius-sm)",
				cursor: disabled ? "default" : "grab",
			}}
		>
			{!disabled && (
				<IconGripVertical
					size={18}
					{...attributes}
					{...listeners}
					style={{ cursor: isDragging ? "grabbing" : "grab" }}
				/>
			)}
			<Text fw={500} size="sm">
				{index + 1}.
			</Text>
			<Text>{item}</Text>
		</Group>
	);
}

// Ranking Renderer
function RankingRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: RankingQuestion;
	value: string[];
	onChange: (value: string[]) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	// Initialize with question item keys if no value
	const itemKeys = Object.keys(question.items);
	const items = value && value.length > 0 ? value : itemKeys;
	const [activeId, setActiveId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = items.indexOf(active.id as string);
			const newIndex = items.indexOf(over.id as string);

			const newItems = [...items];
			const [movedItem] = newItems.splice(oldIndex, 1);
			newItems.splice(newIndex, 0, movedItem!);

			onChange(newItems);
		}

		setActiveId(null);
	};

	const handleDragCancel = () => {
		setActiveId(null);
	};

	const activeIndex = activeId ? items.indexOf(activeId) : -1;
	const activeItemLabel = activeId ? question.items[activeId] : null;

	return (
		<Stack gap="sm">
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={handleDragCancel}
			>
				<SortableContext items={items} strategy={verticalListSortingStrategy}>
					<Stack gap="xs">
						{items.map((itemKey, index) => (
							<SortableItem
								key={itemKey}
								id={itemKey}
								item={question.items[itemKey]!}
								index={index}
								disabled={disabled}
							/>
						))}
					</Stack>
				</SortableContext>
				<DragOverlay>
					{activeId && activeItemLabel ? (
						<Group
							gap="sm"
							p="sm"
							style={{
								backgroundColor: "var(--mantine-color-default)",
								border: "1px solid var(--mantine-color-default-border)",
								borderRadius: "var(--mantine-radius-sm)",
								cursor: "grabbing",
							}}
						>
							<IconGripVertical size={18} />
							<Text fw={500} size="sm">
								{activeIndex + 1}.
							</Text>
							<Text>{activeItemLabel}</Text>
						</Group>
					) : null}
				</DragOverlay>
			</DndContext>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Single Selection Matrix Renderer
function SingleSelectionMatrixRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: SingleSelectionMatrixQuestion;
	value: Record<string, string>;
	onChange: (value: Record<string, string>) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	const answers = value || {};

	const handleChange = (rowKey: string, columnKey: string) => {
		onChange({
			...answers,
			[rowKey]: columnKey,
		});
	};

	return (
		<Stack gap="sm">
			<Table striped highlightOnHover withTableBorder>
				<Table.Thead>
					<Table.Tr>
						<Table.Th />
						{Object.entries(question.columns).map(
							([columnKey, columnLabel]) => (
								<Table.Th key={columnKey}>{columnLabel}</Table.Th>
							),
						)}
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{Object.entries(question.rows).map(([rowKey, rowLabel]) => (
						<Table.Tr key={rowKey}>
							<Table.Td>{rowLabel}</Table.Td>
							{Object.keys(question.columns).map((columnKey) => (
								<Table.Td key={`${rowKey}-${columnKey}`}>
									<Radio
										checked={answers[rowKey] === columnKey}
										onChange={() => handleChange(rowKey, columnKey)}
										disabled={disabled}
									/>
								</Table.Td>
							))}
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Multiple Selection Matrix Renderer
function MultipleSelectionMatrixRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: MultipleSelectionMatrixQuestion;
	value: Record<string, string>;
	onChange: (value: Record<string, string>) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	const answers = value || {};

	const handleChange = (rowKey: string, selectedValue: string | null) => {
		const newAnswers = { ...answers };
		if (selectedValue) {
			newAnswers[rowKey] = selectedValue;
		} else {
			delete newAnswers[rowKey];
		}
		onChange(newAnswers);
	};

	// Convert columns object to Mantine Select data format
	const columnData = Object.entries(question.columns).map(([key, label]) => ({
		value: key,
		label: label,
	}));

	return (
		<Stack gap="sm">
			<Table striped highlightOnHover withTableBorder>
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Question</Table.Th>
						<Table.Th>Answer</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{Object.entries(question.rows).map(([rowKey, rowLabel]) => (
						<Table.Tr key={rowKey}>
							<Table.Td>{rowLabel}</Table.Td>
							<Table.Td>
								<Select
									value={answers[rowKey] || null}
									onChange={(val) => handleChange(rowKey, val)}
									data={columnData}
									placeholder="Select an option"
									disabled={disabled}
									clearable
								/>
							</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}

// Whiteboard Renderer
function WhiteboardRenderer({
	question,
	value,
	onChange,
	showFeedback,
	disabled,
}: {
	question: WhiteboardQuestion;
	value: string;
	onChange: (value: string) => void;
	showFeedback: boolean;
	disabled: boolean;
}) {
	const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const { colorScheme } = useMantineColorScheme();
	const { ref: fullscreenRef, toggle, fullscreen } = useFullscreen();
	const mounted = useMounted();
	const initialData = useWhiteboardData(value);

	// Sync theme with Mantine's color scheme
	useLayoutEffect(() => {
		if (excalidrawRef.current) {
			const theme = colorScheme === "dark" ? "dark" : "light";
			excalidrawRef.current.updateScene({ appState: { theme } });
		}
	}, [colorScheme]);

	// Create a debounced callback to save the whiteboard state
	const saveSnapshot = useDebouncedCallback(
		(
			elements: readonly OrderedExcalidrawElement[],
			appState: AppState,
			files: BinaryFiles,
		) => {
			// Check if there are any non-deleted elements
			const elementList = elements;
			const hasContent =
				Array.isArray(elementList) &&
				elementList.length > 0 &&
				elementList.filter((element) => !element.isDeleted).length > 0;

			if (!hasContent) {
				// If no content, clear the value
				onChange(undefined as unknown as string);
			} else {
				const data = {
					elements,
					appState,
					files,
				};
				onChange(JSON.stringify(data));
			}
		},
		500,
	);

	return (
		<Stack gap="sm">
			<Box
				ref={fullscreenRef}
				style={{
					height: "500px",
					border: "1px solid var(--mantine-color-default-border)",
					borderRadius: "var(--mantine-radius-sm)",
				}}
			>
				{!mounted ? (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
						}}
					>
						<Loader />
					</div>
				) : (
					<Suspense
						fallback={
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									height: "100%",
								}}
							>
								<Loader />
							</div>
						}
					>
						<Excalidraw
							excalidrawAPI={(api) => {
								excalidrawRef.current = api;
							}}
							initialData={initialData}
							onChange={(elements, appState, files) => {
								if (!disabled) {
									saveSnapshot(elements, appState, files);
								}
							}}
							theme={colorScheme === "dark" ? "dark" : "light"}
							viewModeEnabled={disabled}
							renderTopRightUI={() => (
								<Tooltip
									label={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
								>
									<ActionIcon
										onClick={toggle}
										variant="default"
										size="lg"
										aria-label={
											fullscreen ? "Exit fullscreen" : "Enter fullscreen"
										}
									>
										{fullscreen ? (
											<IconMinimize size={18} />
										) : (
											<IconMaximize size={18} />
										)}
									</ActionIcon>
								</Tooltip>
							)}
						/>
					</Suspense>
				)}
			</Box>
			{showFeedback && question.feedback && (
				<Text size="sm" c="dimmed">
					{question.feedback}
				</Text>
			)}
		</Stack>
	);
}
