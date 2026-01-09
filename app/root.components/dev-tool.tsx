import { JsonTree } from "@gfazioli/mantine-json-tree";
import {
	Affix,
	Button,
	NativeSelect,
	Popover,
	ScrollArea,
	SegmentedControl,
	Stack,
	Text,
	Tabs,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { IconBug, IconSettings } from "@tabler/icons-react";
import { useMemo, useState } from "react";

interface DevToolProps {
	data: unknown;
}

type AffixPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const POSITION_MAP: Record<AffixPosition, { top?: number; bottom?: number; left?: number; right?: number }> = {
	"top-left": { top: 20, left: 20 },
	"top-right": { top: 20, right: 20 },
	"bottom-left": { bottom: 20, left: 20 },
	"bottom-right": { bottom: 20, right: 20 },
};

export function DevTool({ data }: DevToolProps) {
	const [opened, setOpened] = useState(false);
	const [position, setPosition] = useLocalStorage<AffixPosition>({
		key: "dev-tool-position",
		defaultValue: "bottom-right",
	});
	const [selectedKey, setSelectedKey] = useLocalStorage<string | null>({
		key: "dev-tool-selected-key",
		defaultValue: null,
	});

	const affixPosition = POSITION_MAP[position];

	// Extract available keys from data object
	const dataKeys = useMemo(() => {
		if (data && typeof data === "object" && !Array.isArray(data)) {
			return Object.keys(data);
		}
		return [];
	}, [data]);

	// Get the data to display based on selection
	const displayData = useMemo(() => {
		if (!selectedKey || selectedKey === "all" || !data || typeof data !== "object" || Array.isArray(data)) {
			return data;
		}
		return (data as Record<string, unknown>)[selectedKey];
	}, [data, selectedKey]);

	// Create select options
	const selectOptions = useMemo(() => {
		const options = [{ value: "all", label: "All Data" }];
		dataKeys.forEach((key) => {
			options.push({ value: key, label: key });
		});
		return options;
	}, [dataKeys]);

	return (
		<Affix position={affixPosition}>
			<Popover
				opened={opened}
				onChange={setOpened}
				width={600}
				position="top"
				withArrow
				shadow="md"
			>
				<Popover.Target>
					<Button
						leftSection={<IconBug size={16} />}
						onClick={() => setOpened((o) => !o)}
						variant="filled"
						color="gray"
					>
						Dev Tools
					</Button>
				</Popover.Target>
				<Popover.Dropdown>
					<Tabs defaultValue="data">
						<Tabs.List>
							<Tabs.Tab value="data">Data</Tabs.Tab>
							<Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
								Settings
							</Tabs.Tab>
						</Tabs.List>

						<Tabs.Panel value="data" pt="md" style={{ height: "500px", display: "flex", flexDirection: "column" }}>
							<Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
								{dataKeys.length > 0 && (
									<NativeSelect
										label="Select Data to Display"
										data={selectOptions}
										value={selectedKey ?? "all"}
										onChange={(event) => setSelectedKey(event.currentTarget.value)}
									/>
								)}
								<ScrollArea style={{ flex: 1 }}>
									<JsonTree
										data={displayData}
										defaultExpanded
										maxDepth={3}
										title={selectedKey && selectedKey !== "all" ? selectedKey : "Loader Data"}
										showIndentGuides
										withCopyToClipboard
										withExpandAll
									/>
								</ScrollArea>
							</Stack>
						</Tabs.Panel>

						<Tabs.Panel value="settings" pt="md" style={{ height: "500px" }}>
							<Stack gap="md">
								<Text size="sm" fw={500}>
									Position
								</Text>
								<SegmentedControl
									value={position}
									onChange={(value) => setPosition(value as AffixPosition)}
									data={[
										{ label: "Top Left", value: "top-left" },
										{ label: "Top Right", value: "top-right" },
										{ label: "Bottom Left", value: "bottom-left" },
										{ label: "Bottom Right", value: "bottom-right" },
									]}
									fullWidth
								/>
							</Stack>
						</Tabs.Panel>
					</Tabs>
				</Popover.Dropdown>
			</Popover>
		</Affix>
	);
}
