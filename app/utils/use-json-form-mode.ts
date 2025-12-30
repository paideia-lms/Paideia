import type { UseFormInput, UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { OnMount } from "@monaco-editor/react";
import { useCallback, useRef, useState } from "react";

export interface UseJsonFormModeReturn<T> {
	form: UseFormReturnType<T>;
	isJsonMode: boolean;
	toggleJsonMode: () => void;
	jsonEditorProps: {
		key: number;
		defaultValue: string;
		onMount: OnMount;
	};
	onSubmitWithJsonSync: (
		handler: (values: T) => void | Promise<void>,
	) => (event?: React.FormEvent<HTMLFormElement>) => void;
}

export function useJsonFormMode<T extends Record<string, unknown>>(
	options?: UseFormInput<T>,
): UseJsonFormModeReturn<T> {
	const form = useForm<T>(options);
	const [isJsonMode, setIsJsonMode] = useState(false);
	const [jsonEditorKey, setJsonEditorKey] = useState(0);
	const [initialJsonContent, setInitialJsonContent] = useState<string>("");
	const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

	const handleSwitchToJsonMode = useCallback(() => {
		const allValues = form.getValues();
		const jsonString = JSON.stringify(allValues, null, 2);
		setInitialJsonContent(jsonString);
		setJsonEditorKey((prev) => prev + 1);
		setIsJsonMode(true);
	}, [form]);

	const handleSwitchToFormMode = useCallback(() => {
		try {
			const editor = editorRef.current;
			if (!editor) {
				notifications.show({
					title: "Error",
					message: "Editor instance not available",
					color: "red",
				});
				return;
			}

			const jsonContent = editor.getValue();
			const parsed = JSON.parse(jsonContent) as Partial<T>;
			form.setValues(parsed);
			setIsJsonMode(false);
		} catch (error) {
			notifications.show({
				title: "Invalid JSON",
				message:
					error instanceof Error ? error.message : "Failed to parse JSON",
				color: "red",
			});
			// Stay in JSON mode if parsing fails
		}
	}, [form]);

	const toggleJsonMode = useCallback(() => {
		if (isJsonMode) {
			handleSwitchToFormMode();
		} else {
			handleSwitchToJsonMode();
		}
	}, [isJsonMode, handleSwitchToFormMode, handleSwitchToJsonMode]);

	const onMount = useCallback((editor: Parameters<OnMount>[0]) => {
		editorRef.current = editor;
	}, []);

	const syncJsonToForm = useCallback(() => {
		if (!isJsonMode) return true;

		try {
			const editor = editorRef.current;
			if (!editor) {
				notifications.show({
					title: "Error",
					message: "Editor instance not available",
					color: "red",
				});
				return false;
			}

			const jsonContent = editor.getValue();
			const parsed = JSON.parse(jsonContent) as Partial<T>;
			form.setValues(parsed);
			return true;
		} catch (error) {
			notifications.show({
				title: "Invalid JSON",
				message:
					error instanceof Error ? error.message : "Failed to parse JSON",
				color: "red",
			});
			return false;
		}
	}, [isJsonMode, form]);

	// Wrapper for form.onSubmit that automatically syncs JSON before submission
	const onSubmitWithJsonSync = useCallback(
		(handler: (values: T) => void | Promise<void>) => {
			return form.onSubmit((_values: T) => {
				// Sync JSON to form before submission if in JSON mode
				if (!syncJsonToForm()) {
					return; // Don't submit if JSON sync failed
				}
				// Get the updated values after syncing (in case we're in JSON mode)
				const updatedValues = form.getValues();
				return handler(updatedValues);
			});
		},
		[form, syncJsonToForm],
	);

	return {
		form,
		isJsonMode,
		toggleJsonMode,
		jsonEditorProps: {
			key: jsonEditorKey,
			defaultValue: initialJsonContent,
			onMount,
		},
		onSubmitWithJsonSync,
	};
}
