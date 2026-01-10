import { Paper, Typography } from "@mantine/core";

interface PagePreviewProps {
	/** 
	 * html rich text content
	 */
	content: string;
}

export function PagePreview({ content }: PagePreviewProps) {
	return (
		<Paper withBorder p="md" radius="md">
			<Typography
				className="tiptap"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
				dangerouslySetInnerHTML={{ __html: content }}
				style={{
					minHeight: "200px",
					lineHeight: "1.6",
				}}
			/>
		</Paper>
	);
}
