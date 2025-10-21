import { useInterval } from "@mantine/hooks";
import { useState } from "react";

interface UseQuizTimerOptions {
    initialTime?: number; // Time in seconds
    onExpire?: () => void;
}

interface UseQuizTimerReturn {
    timeLeft: number | null;
    isExpired: boolean;
    resetTimer: () => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    formattedTime: string;
}

export function useQuizTimer({
    initialTime,
    onExpire,
}: UseQuizTimerOptions): UseQuizTimerReturn {
    const [timeLeft, setTimeLeft] = useState<number | null>(
        initialTime ?? null,
    );
    const [isExpired, setIsExpired] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const interval = useInterval(
        () => {
            if (timeLeft !== null && timeLeft > 0 && !isPaused) {
                setTimeLeft((prev) => {
                    if (prev === null || prev <= 1) {
                        setIsExpired(true);
                        onExpire?.();
                        return 0;
                    }
                    return prev - 1;
                });
            }
        },
        1000,
        { autoInvoke: initialTime !== undefined },
    );

    const resetTimer = () => {
        setTimeLeft(initialTime ?? null);
        setIsExpired(false);
        setIsPaused(false);
        if (initialTime) {
            interval.start();
        }
    };

    const pauseTimer = () => {
        setIsPaused(true);
    };

    const resumeTimer = () => {
        setIsPaused(false);
    };

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const formattedTime =
        timeLeft !== null ? formatTime(timeLeft) : "00:00";

    return {
        timeLeft,
        isExpired,
        resetTimer,
        pauseTimer,
        resumeTimer,
        formattedTime,
    };
}

