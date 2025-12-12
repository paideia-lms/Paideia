import {
	Paper,
	Stack,
	Text,
	UnstyledButton,
	useMantineColorScheme,
} from "@mantine/core";
import {
	type ForwardedRef,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useState,
} from "react";

export interface MentionItem {
	id: string;
	label: string;
}

interface MentionListProps {
	items: MentionItem[];
	command: (item: MentionItem) => void;
}

export interface MentionListRef {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
	getSelectedItem: () => MentionItem | null;
	selectedItem: MentionItem | null;
}

export const MentionList = forwardRef(
	({ items, command }: MentionListProps, ref: ForwardedRef<MentionListRef>) => {
		const { colorScheme } = useMantineColorScheme();
		const [selectedIndex, setSelectedIndex] = useState(0);
		const [selectedItem, setSelectedItem] = useState<MentionItem | null>(null);

		const selectItem = (index: number) => {
			const item = items[index];

			if (item) {
				setSelectedItem(item);
				command(item);
			}
		};

		const upHandler = () => {
			setSelectedIndex((selectedIndex + items.length - 1) % items.length);
		};

		const downHandler = () => {
			setSelectedIndex((selectedIndex + 1) % items.length);
		};

		const enterHandler = () => {
			selectItem(selectedIndex);
		};

		// biome-ignore lint/correctness/useExhaustiveDependencies: reset selection index when items change
		useEffect(() => setSelectedIndex(0), [items]);

		useImperativeHandle(ref, () => ({
			onKeyDown: ({ event }: { event: KeyboardEvent }) => {
				if (event.key === "ArrowUp") {
					upHandler();
					return true;
				}

				if (event.key === "ArrowDown") {
					downHandler();
					return true;
				}

				if (event.key === "Enter") {
					enterHandler();
					return true;
				}

				return false;
			},
			getSelectedItem: () => selectedItem,
			selectedItem,
		}));

		return (
			<Paper
				withBorder
				shadow="md"
				p="xs"
				style={{
					maxHeight: "300px",
					overflowY: "auto",
					minWidth: "200px",
				}}
			>
				{items.length > 0 ? (
					<Stack gap="2px">
						{items.map((item, index) => (
							<UnstyledButton
								key={item.id}
								onClick={() => selectItem(index)}
								style={{
									padding: "8px 12px",
									borderRadius: "4px",
									backgroundColor:
										index === selectedIndex
											? colorScheme === "dark"
												? "var(--mantine-color-dark-6)"
												: "var(--mantine-color-gray-2)"
											: "transparent",
									transition: "background-color 0.1s",
									textAlign: "left",
									width: "100%",
								}}
								onMouseEnter={() => setSelectedIndex(index)}
							>
								<Text size="sm">{item.label}</Text>
							</UnstyledButton>
						))}
					</Stack>
				) : (
					<Text size="sm" c="dimmed" p="xs">
						No results
					</Text>
				)}
			</Paper>
		);
	},
);

MentionList.displayName = "MentionList";
