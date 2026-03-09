import { QuizTimeLimitExceededError } from "server/errors";

/**
 * Validates quiz time limit
 * Throws QuizTimeLimitExceededError if time limit is exceeded (unless bypassed)
 *
 * @param startedAt - ISO string of when the quiz was started
 * @param globalTimer - Time limit in seconds from quiz config
 * @param bypassTimeLimit - If true, skips the time limit check (useful for auto-submit)
 * @throws QuizTimeLimitExceededError if time limit is exceeded
 */

export function assertTimeLimit({
	startedAt, globalTimer, bypassTimeLimit = false,
}: {
	startedAt: string | null | undefined;
	globalTimer: number | null | undefined;
	bypassTimeLimit?: boolean;
}): void {
	// Skip check if bypassed or no time limit configured
	if (bypassTimeLimit || !globalTimer || !startedAt) {
		return;
	}

	// Convert globalTimer from seconds to minutes
	const timeLimitMinutes = globalTimer / 60;

	// Calculate elapsed time
	const startedAtDate = new Date(startedAt);
	const now = new Date();
	const timeElapsedMinutes = (now.getTime() - startedAtDate.getTime()) / (1000 * 60);

	// Check if time limit is exceeded
	if (timeElapsedMinutes > timeLimitMinutes) {
		throw new QuizTimeLimitExceededError(
			`Quiz time limit of ${timeLimitMinutes} minutes has been exceeded. Time elapsed: ${Math.ceil(timeElapsedMinutes)} minutes.`
		);
	}
}
