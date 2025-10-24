import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
	ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import {
	Box,
	Loader,
	Stack,
	Textarea,
	Title,
	useMantineColorScheme,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useDebouncedCallback, useMounted, usePrevious } from "@mantine/hooks";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { useFormWatchValue } from "~/utils/form-utils";
import { CommonFields } from "./common-fields";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
	import("@excalidraw/excalidraw").then((module) => ({
		default: module.Excalidraw,
	})),
);

interface WhiteboardFormProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
	isLoading?: boolean;
}

const useWhiteboardData = (whiteboardContent: string) => {
	const mounted = useMounted();
	const prevMounted = usePrevious(mounted);
	const [data, setData] = useState<ExcalidrawInitialDataState | null>(null);
	const [hasSetData, setHasSetData] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useLayoutEffect(() => {
		if (
			mounted &&
			prevMounted &&
			whiteboardContent &&
			whiteboardContent.trim().length > 0
		) {
			try {
				if (hasSetData) {
					return;
				}
				setHasSetData(true);
				console.log("Loading whiteboard data");
				const data = JSON.parse(
					whiteboardContent,
				) as ExcalidrawInitialDataState;
				setData({
					...data,
					appState: {
						...data.appState,
						collaborators: new Map(),
					},
				});
			} catch (error: unknown) {
				console.error("Failed to load whiteboard data:", error);
				setData({
					appState: {
						collaborators: new Map(),
					},
				});
			}
		} else {
			setData({
				appState: {
					collaborators: new Map(),
				},
			});
		}
	}, [mounted, prevMounted, whiteboardContent]);

	return data as ExcalidrawInitialDataState;
};

export function WhiteboardForm({ form }: WhiteboardFormProps) {
	const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const { colorScheme } = useMantineColorScheme();
	const whiteboardContent = useFormWatchValue(form, "whiteboardContent");
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
			appState: AppState,
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
		<Stack gap="md">
			<CommonFields form={form} />

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
				<Box style={{ height: "500px", border: "1px solid #dee2e6" }}>
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
							/>
						</Suspense>
					)}
				</Box>
			</div>
		</Stack>
	);
}
