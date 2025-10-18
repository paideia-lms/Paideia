import { Box, Stack, Title } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useLayoutEffect, useMemo, useState } from "react";
import {
	createTLStore,
	DefaultSpinner,
	getSnapshot,
	loadSnapshot,
	type TLEditorSnapshot,
	Tldraw,
} from "tldraw";
import "tldraw/tldraw.css";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { CommonFields } from "./common-fields";

interface WhiteboardFormProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
}

export function WhiteboardForm({ form }: WhiteboardFormProps) {
	// Create a store instance
	const store = useMemo(() => createTLStore(), []);

	const [loadingState, setLoadingState] = useState<
		| { status: "loading" }
		| { status: "ready" }
		| { status: "error"; error: string }
	>({
		status: "loading",
	});

	useLayoutEffect(() => {
		setLoadingState({ status: "loading" });

		// Get persisted data from form description field
		const existingDescription = form.getValues().description;

		if (existingDescription && existingDescription.trim().length > 0) {
			try {
				const snapshot = JSON.parse(
					existingDescription,
				) as Partial<TLEditorSnapshot>;
				loadSnapshot(store, snapshot);
				setLoadingState({ status: "ready" });
			} catch (error: unknown) {
				console.error("Failed to load whiteboard data:", error);
				setLoadingState({ status: "ready" }); // Continue with empty store on error
			}
		} else {
			setLoadingState({ status: "ready" }); // Nothing persisted, continue with empty store
		}

		// Each time the store changes, save to form (with debouncing)
		let timeoutId: NodeJS.Timeout;
		const cleanupFn = store.listen(() => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				const snapshot = getSnapshot(store);
				form.setFieldValue("description", JSON.stringify(snapshot));
			}, 500);
		});

		return () => {
			clearTimeout(timeoutId);
			cleanupFn();
		};
	}, [store, form]);

	return (
		<Stack gap="md">
			<CommonFields form={form} />

			<div>
				<Title order={5} mb="xs">
					Whiteboard Canvas
				</Title>
				<Box style={{ height: "500px", border: "1px solid #dee2e6" }}>
					{loadingState.status === "loading" && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								height: "100%",
							}}
						>
							<DefaultSpinner />
						</div>
					)}
					{loadingState.status === "error" && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								height: "100%",
								flexDirection: "column",
							}}
						>
							<h3>Error loading whiteboard</h3>
							<p>{loadingState.error}</p>
						</div>
					)}
					{loadingState.status === "ready" && <Tldraw store={store} />}
				</Box>
			</div>
		</Stack>
	);
}
