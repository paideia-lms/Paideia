import { ActionIcon, Group, Text, TextInput, Tooltip } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconInfoCircle, IconSearch } from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { parseAsString } from "nuqs/server";
import { useState } from "react";

export default function CourseSearchInput() {
	const [query, setQuery] = useQueryState(
		"query",
		parseAsString.withDefault("").withOptions({ shallow: false }),
	);

	const [input, setInput] = useState(query);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		setQuery(value || null);
	}, 500);

	return (
		<>
			{/* SEO Meta */}
			<meta
				name="description"
				content="Search courses by status, category or free text."
			/>
			<meta property="og:title" content="Course Search" />
			<meta
				property="og:description"
				content="Search courses using free text or advanced filters: status, category."
			/>
			<TextInput
				placeholder='Search... e.g. status:published category:123 category:none category:"computer science"'
				leftSection={<IconSearch size={16} />}
				value={input}
				onChange={(e) => {
					const v = e.currentTarget.value;
					setInput(v);
					debouncedSetQuery(v);
				}}
				mb="md"
				label={
					<Group gap="xs" wrap="nowrap" align="center">
						<Text>Search</Text>
						<Tooltip
							withArrow
							multiline
							w={360}
							label={
								<div>
									<Text size="xs">
										Free text matches title, description, slug. You can also use
										filters:
									</Text>
									<Text size="xs">- status:published</Text>
									<Text size="xs">- category:123 (by ID)</Text>
									<Text size="xs">- category:none (uncategorized)</Text>
									<Text size="xs">
										- category:&quot;computer science&quot; (by name, partial
										match)
									</Text>
								</div>
							}
						>
							<IconInfoCircle size={14} />
						</Tooltip>
					</Group>
				}
			/>
		</>
	);
}
