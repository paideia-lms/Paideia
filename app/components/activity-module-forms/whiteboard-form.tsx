import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
	ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import {
	ActionIcon,
	Box,
	Button,
	Loader,
	TextInput,
	Stack,
	Textarea,
	Title,
	Tooltip,
	useMantineColorScheme,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useDebouncedCallback,
	useFullscreen,
	useMounted,
} from "@mantine/hooks";
import { IconMaximize, IconMinimize } from "@tabler/icons-react";
import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { useWhiteboardData } from "./use-whiteboard-data";
import type { WhiteboardFormInitialValues as EditWhiteboardFormInitialValues } from "app/routes/user/module/edit-setting";
import type { WhiteboardFormInitialValues as NewWhiteboardFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
	import("@excalidraw/excalidraw").then((module) => ({
		default: module.Excalidraw,
	})),
);

type WhiteboardFormData = Simplify<
	UnionToIntersection<
		NewWhiteboardFormInitialValues | EditWhiteboardFormInitialValues
	>
>;

interface WhiteboardFormProps {
	initialValues?: Partial<WhiteboardFormData>;
	onSubmit: (values: WhiteboardFormData) => void;
	isLoading?: boolean;
}

export function WhiteboardForm({
	initialValues,
	onSubmit,
	isLoading,
}: WhiteboardFormProps) {
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			whiteboardContent: initialValues?.whiteboardContent ?? "",
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const { colorScheme } = useMantineColorScheme();
	const { ref: fullscreenRef, toggle, fullscreen } = useFullscreen();
	useFormWatchForceUpdate(form, "whiteboardContent");
	const whiteboardContent = form.getValues().whiteboardContent;
	const mounted = useMounted();

	//  only calculate when first rendered
	const initialData = useWhiteboardData(whiteboardContent);

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
			_appState: AppState,
			files: BinaryFiles,
		) => {
			const data: ExcalidrawInitialDataState = {
				elements,
				appState: {
					collaborators: new Map(),
				},
				files,
			};
			form.setFieldValue("whiteboardContent", JSON.stringify(data));
		},
		200,
	);

	return (
		<form onSubmit={form.onSubmit(onSubmit)}>
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

				<div>
					<Title order={5} mb="xs">
						Whiteboard Canvas
					</Title>
					<Box
						ref={fullscreenRef}
						style={{ height: "500px", border: "1px solid #dee2e6" }}
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
										saveSnapshot(elements, appState, files);
									}}
									theme={colorScheme === "dark" ? "dark" : "light"}
									renderTopRightUI={() => (
										<Tooltip
											label={
												fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"
											}
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
				</div>

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}
