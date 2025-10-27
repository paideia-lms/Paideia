import {
	IconBook,
	IconClipboardList,
	IconMessage,
	IconPencil,
	IconPresentation,
	IconWriting,
} from "@tabler/icons-react";

// Helper function to get icon for module type
export function getModuleIcon(
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion",
	size?: number,
) {
	switch (type) {
		case "page":
			return <IconBook size={size ?? 20} />;
		case "whiteboard":
			return <IconPresentation size={size ?? 20} />;
		case "assignment":
			return <IconPencil size={size ?? 20} />;
		case "quiz":
			return <IconClipboardList size={size ?? 20} />;
		case "discussion":
			return <IconMessage size={size ?? 20} />;
		default:
			return <IconWriting size={size ?? 20} />;
	}
}

// Helper function to get badge color for module type
export function getModuleColor(
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion",
) {
	switch (type) {
		case "page":
			return "blue";
		case "whiteboard":
			return "purple";
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
