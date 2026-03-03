import { Input, Popover } from "@mantine/core";
import { MonthPicker } from "@mantine/dates";
import dayjs from "dayjs";
import { useState } from "react";

interface MonthPickerInputProps {
	label?: string;
	value: string | null;
	onChange: (value: string | null) => void;
	clearable?: boolean;
}

export function MonthPickerInput({
	label,
	value,
	onChange,
	clearable = false,
}: MonthPickerInputProps) {
	const [opened, setOpened] = useState(false);
	const displayValue = value ? dayjs(value).format("MMMM YYYY") : "";

	return (
		<Input.Wrapper label={label}>
			<Popover
				opened={opened}
				onChange={setOpened}
				position="bottom-start"
				withArrow
				shadow="md"
			>
				<Popover.Target>
					<Input
						component="button"
						type="button"
						pointer
						onClick={() => setOpened((o) => !o)}
						style={{ textAlign: "left" }}
					>
						{displayValue || <Input.Placeholder>Select month</Input.Placeholder>}
					</Input>
				</Popover.Target>
				<Popover.Dropdown>
					<MonthPicker
						value={value}
						onChange={(val: string | null) => {
							onChange(val);
							setOpened(false);
						}}
						allowDeselect={clearable}
					/>
				</Popover.Dropdown>
			</Popover>
		</Input.Wrapper>
	);
}
