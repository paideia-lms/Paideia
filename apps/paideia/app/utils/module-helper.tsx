import {
	IconBook,
	IconClipboardList,
	IconFile,
	IconMessage,
	IconPencil,
	IconPresentation,
	IconWriting,
} from "@tabler/icons-react";

// Helper function to get icon for module type
export function getModuleIcon(
	type: "page" | "whiteboard" | "file" | "assignment" | "quiz" | "discussion",
	size?: number,
	color?: string,
) {
	switch (type) {
		case "page":
			return <IconBook size={size ?? 20} color={color} />;
		case "whiteboard":
			return <IconPresentation size={size ?? 20} color={color} />;
		case "file":
			return <IconFile size={size ?? 20} color={color} />;
		case "assignment":
			return <IconPencil size={size ?? 20} color={color} />;
		case "quiz":
			return <IconClipboardList size={size ?? 20} color={color} />;
		case "discussion":
			return <IconMessage size={size ?? 20} color={color} />;
		default:
			return <IconWriting size={size ?? 20} color={color} />;
	}
}

// Helper function to get badge color for module type
export function getModuleColor(
	type: "page" | "whiteboard" | "file" | "assignment" | "quiz" | "discussion",
) {
	switch (type) {
		case "page":
			return "blue";
		case "whiteboard":
			return "purple";
		case "file":
			return "indigo";
		case "assignment":
			return "orange";
		case "quiz":
			return "green";
		case "discussion":
			return "cyan";
		default:
			return "gray";
	}
}
