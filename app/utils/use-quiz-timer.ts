import { useInterval } from "@mantine/hooks";
import { useState } from "react";

interface UseQuizTimerOptions {
	/**
	 * The initial time in seconds. If not provided, the timer will start from the remaining time.
	 */
	initialTime?: number;
	/**
	 * The remaining time in seconds. If not provided, the timer will start from the initial time.
	 */
	remainingTime?: number;
	/**
	 * The function to call when the timer expires.
	 */
	onExpire?: () => void;
}

export function useServerTimer({
	initialTime,
	remainingTime,
	onExpire,
}: UseQuizTimerOptions) {
	// Use remainingTime if provided (for resumed quizzes), otherwise use initialTime
	// Note: This hook should be remounted (via key prop) when remainingTime changes
	const [timeLeft, setTimeLeft] = useState<number | null>(
		remainingTime !== undefined ? remainingTime : (initialTime ?? null),
	);

	const _interval = useInterval(
		() => {
			if (timeLeft !== null && timeLeft > 0) {
				setTimeLeft((prev) => {
					if (prev === null || prev <= 1) {
						// setIsExpired(true);
						onExpire?.();
						return 0;
					}
					return prev - 1;
				});
			}
		},
		1000,
		{ autoInvoke: initialTime !== undefined || remainingTime !== undefined },
	);

	const formatTime = (seconds: number): string => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
	};

	const formattedTime = timeLeft !== null ? formatTime(timeLeft) : "00:00";

	return {
		timeLeft,
		isExpired: timeLeft === 0,
		formattedTime,
	};
}
