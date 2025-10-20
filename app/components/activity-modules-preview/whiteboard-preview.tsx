import type {
	ExcalidrawImperativeAPI,
	ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { Loader, Paper, useMantineColorScheme } from "@mantine/core";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
	import("@excalidraw/excalidraw").then((module) => ({
		default: module.Excalidraw,
	})),
);

interface WhiteboardPreviewProps {
	content: string;
}

export function WhiteboardPreview({ content }: WhiteboardPreviewProps) {
	const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const { colorScheme } = useMantineColorScheme();
	const [initialData, setInitialData] = useState<ExcalidrawInitialDataState>({
		appState: {
			collaborators: new Map(),
		},
	});
	const [isClient, setIsClient] = useState(false);

	// Ensure we're on the client side
	useLayoutEffect(() => {
		setIsClient(true);
	}, []);

	// Load content
	useLayoutEffect(() => {
		if (content) {
			try {
				const data = JSON.parse(content) as ExcalidrawInitialDataState;
				// Ensure appState has the required structure
				setInitialData({
					...data,
					appState: {
						...data.appState,
						collaborators: new Map(),
					},
				});
			} catch (error) {
				console.error("Failed to load whiteboard content:", error);
				setInitialData({
					appState: {
						collaborators: new Map(),
					},
				});
			}
		}
	}, [content]);

	// Sync theme with Mantine's color scheme
	useLayoutEffect(() => {
		if (excalidrawRef.current) {
			const theme = colorScheme === "dark" ? "dark" : "light";
			excalidrawRef.current.updateScene({
				appState: { theme, viewModeEnabled: true },
			});
		}
	}, [colorScheme]);

	return (
		<Paper
			withBorder
			radius="md"
			style={{ height: "600px", overflow: "hidden" }}
		>
			{!isClient ? (
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
						viewModeEnabled={true}
						theme={colorScheme === "dark" ? "dark" : "light"}
					/>
				</Suspense>
			)}
		</Paper>
	);
}
