// ============================================================================
// Helper Functions for Submission Tables
// ============================================================================
/**
 * Groups submissions by student ID
 */

export function groupSubmissionsByStudent<
	T extends { student: { id: number } },
>(submissions: T[]): Map<number, T[]> {
	const submissionsByStudent = new Map<number, T[]>();
	for (const submission of submissions) {
		const studentId = submission.student.id;
		if (!submissionsByStudent.has(studentId)) {
			submissionsByStudent.set(studentId, []);
		}
		submissionsByStudent.get(studentId)?.push(submission);
	}
	return submissionsByStudent;
}
