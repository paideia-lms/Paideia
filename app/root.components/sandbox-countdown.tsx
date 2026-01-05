import { Affix, Text } from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { useState } from "react";

interface SandboxCountdownProps {
	nextResetTime: string;
}

export function SandboxCountdown({ nextResetTime }: SandboxCountdownProps) {
	const calculateTimeLeft = (): number => {
		const now = Date.now();
		const resetTime = new Date(nextResetTime).getTime();
		const difference = resetTime - now;
		return Math.max(0, Math.floor(difference / 1000)); // Return seconds, ensure non-negative
	};

	const [timeLeft, setTimeLeft] = useState<number>(calculateTimeLeft);

	const interval = useInterval(
		() => {
			const newTimeLeft = calculateTimeLeft();
			setTimeLeft(newTimeLeft);
			if (newTimeLeft <= 0) {
				interval.stop();
			}
		},
		1000,
		{ autoInvoke: true },
	);

	const formatTime = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m ${secs}s`;
		}
		if (minutes > 0) {
			return `${minutes}m ${secs}s`;
		}
		return `${secs}s`;
	};

	const formattedTime = formatTime(timeLeft);

	return (
		<Affix position={{ bottom: 0, right: 20 }}>
			<Text size="sm" c="dimmed" style={{ padding: "8px 12px" }} bg="dark">
				This site will be reset in {formattedTime}
			</Text>
		</Affix>
	);
}
