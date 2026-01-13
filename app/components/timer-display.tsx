import { Badge } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { memo } from "react";
import { useQuizTimer } from "../utils/use-quiz-timer";

const getTimerColor = (timeLeft: number | null, initial?: number) => {
	if (timeLeft === null || !initial) return "blue";
	const percentage = (timeLeft / initial) * 100;
	if (percentage > 50) return "green";
	if (percentage > 20) return "yellow";
	return "red";
};

// Memoized timer display component to prevent unnecessary re-renders
// Key prop should be used to remount when remainingTime changes
export const TimerDisplay = memo(
	({
		initialTime,
		remainingTime,
		onExpire,
	}: {
		initialTime?: number;
		remainingTime?: number;
		onExpire: () => void;
	}) => {
		const timer = useQuizTimer({ initialTime, remainingTime, onExpire });

		// Use remainingTime if provided, otherwise use initialTime
		const effectiveInitialTime =
			remainingTime !== undefined ? remainingTime : initialTime;
		if (!effectiveInitialTime) return null;

		return (
			<Badge
				size="lg"
				color={getTimerColor(timer.timeLeft, effectiveInitialTime)}
				leftSection={<IconClock size={16} />}
			>
				{timer.formattedTime}
			</Badge>
		);
	},
);

TimerDisplay.displayName = "TimerDisplay";
