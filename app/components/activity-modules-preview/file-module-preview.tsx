import { Paper, Text } from "@mantine/core";
import { FilePreview } from "./file-preview";

interface FileModuleData {
	id: number;
	media:
		| Array<
				| number
				| {
						id: number;
						filename?: string | null;
						mimeType?: string | null;
						filesize?: number | null;
				  }
		  >
		| null
		| undefined;
}

interface FileModulePreviewProps {
	fileModule: FileModuleData | null | undefined;
}

export function FileModulePreview({ fileModule }: FileModulePreviewProps) {
	if (!fileModule) {
		return (
			<Paper withBorder p="md" radius="md">
				<Text c="dimmed" size="sm">
					No file module data available.
				</Text>
			</Paper>
		);
	}

	const files = fileModule.media || [];

	return <FilePreview files={files} />;
}
