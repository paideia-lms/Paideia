import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { Clock } from "@gfazioli/mantine-clock";
import { IconBooks, IconSchool } from "@tabler/icons-react";
import dayjs from "dayjs";
import { Link, href } from "react-router";

interface GreetingHeaderProps {
	greeting: string;
	userName: string;
	timeZone?: string;
	neonClassNames?: any;
}

export function GreetingHeader({
	greeting,
	userName,
	timeZone,
	neonClassNames,
}: GreetingHeaderProps) {
	return (
		<Group justify="space-between" align="flex-start">
			<Group gap="lg" align="flex-start">
				<Clock
					size={120}
					secondHandBehavior="smooth"
					classNames={neonClassNames}
				/>
				<Stack gap="xs">
					<Title order={1}>
						{greeting}, {userName}!
					</Title>
					<Text c="dimmed" size="lg">
						It's {dayjs().format("dddd, MMMM D, YYYY")}
					</Text>
					<Text size="xs" c="dimmed">
						Timezone: {timeZone || "Not detected"}
					</Text>
				</Stack>
			</Group>
			<Group>
				<Button
					component={Link}
					to={href("/course")}
					leftSection={<IconBooks size={16} />}
					variant="light"
				>
					My Courses
				</Button>
				<Button
					component={Link}
					to={href("/user/overview/:id?", { id: undefined })}
					leftSection={<IconSchool size={16} />}
					variant="outline"
				>
					Profile
				</Button>
			</Group>
		</Group>
	);
}
