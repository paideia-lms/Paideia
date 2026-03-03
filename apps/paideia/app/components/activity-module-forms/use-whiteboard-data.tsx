import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useMounted, usePrevious } from "@mantine/hooks";
import { useLayoutEffect, useState } from "react";

export const useWhiteboardData = (whiteboardContent: string) => {
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
