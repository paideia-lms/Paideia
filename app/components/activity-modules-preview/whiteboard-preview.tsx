import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
	ActionIcon,
	Loader,
	Paper,
	Tooltip,
	useMantineColorScheme,
} from "@mantine/core";
import { useFullscreen, useMounted } from "@mantine/hooks";
import { IconMaximize, IconMinimize } from "@tabler/icons-react";
import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { useWhiteboardData } from "../activity-module-forms/useWhiteboardData";

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
	const { ref: fullscreenRef, toggle, fullscreen } = useFullscreen();
	const mounted = useMounted();
	const initialData = useWhiteboardData(content);

	// Sync theme with Mantine's color scheme
	useLayoutEffect(() => {
		if (excalidrawRef.current) {
			const theme = colorScheme === "dark" ? "dark" : "light";
			excalidrawRef.current.updateScene({
				appState: { theme, viewModeEnabled: true },
			});
		}
	}, [colorScheme]);

	console.log(initialData);

	return (
		<Paper
			ref={fullscreenRef}
			withBorder
			radius="md"
			style={{ height: "600px", overflow: "hidden" }}
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
						viewModeEnabled={true}
						theme={colorScheme === "dark" ? "dark" : "light"}
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
		</Paper>
	);
}
