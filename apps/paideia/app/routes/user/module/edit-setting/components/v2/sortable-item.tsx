import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box } from "@mantine/core";
import { cloneElement, isValidElement } from "react";
import type { CSSProperties, ReactNode } from "react";

interface SortableItemProps {
	id: string;
	children: ReactNode;
	disabled?: boolean;
}

export function SortableItem({ id, children, disabled }: SortableItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id, disabled });

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
		position: "relative",
		zIndex: isDragging ? 1 : 0,
	};

	// Pass sortable props to children if it's a React element
	const childrenWithProps = isValidElement(children)
		? cloneElement(children, {
				sortableAttributes: attributes,
				sortableListeners: listeners,
				isDragging,
			} as Record<string, unknown>)
		: children;

	return (
		<Box ref={setNodeRef} style={style} pos="relative">
			{childrenWithProps}
		</Box>
	);
}
