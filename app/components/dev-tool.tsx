import { Affix, Button, Popover, ScrollArea } from "@mantine/core";
import { JsonTree } from "@gfazioli/mantine-json-tree";
import { IconBug } from "@tabler/icons-react";
import { useState } from "react";

interface DevToolProps {
    data: unknown;
}

export function DevTool({ data }: DevToolProps) {
    const [opened, setOpened] = useState(false);

    return (
        <Affix position={{ bottom: 20, right: 20 }}>
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
                    <ScrollArea h={500}>
                        <JsonTree
                            data={data}
                            defaultExpanded
                            maxDepth={3}
                            title="Loader Data"
                            showIndentGuides
                            withCopyToClipboard
                            withExpandAll
                        />
                    </ScrollArea>
                </Popover.Dropdown>
            </Popover>
        </Affix>
    );
}

