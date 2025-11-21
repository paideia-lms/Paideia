// ============================================================================
// Helper Functions for Submission Tables
// ============================================================================

/**
 * Groups submissions by student ID
 */
export function groupSubmissionsByStudent<T extends { student: { id: number } }>(
    submissions: T[],
): Map<number, T[]> {
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

/**
 * Sorts submissions by date (newest first)
 * Uses publishedAt if available, otherwise falls back to createdAt
 */
export function sortSubmissionsByDate<T extends { publishedAt?: string | null; createdAt: string }>(
    submissions: T[],
): T[] {
    return [...submissions].sort((a, b) => {
        const dateA = a.publishedAt
            ? new Date(a.publishedAt)
            : new Date(a.createdAt);
        const dateB = b.publishedAt
            ? new Date(b.publishedAt)
            : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
    });
}

// ============================================================================
// Discussion Submission Helpers
// ============================================================================

type DiscussionSubmission = {
    status: "draft" | "published" | "hidden" | "deleted";
    publishedAt?: string | null;
    createdAt: string;
    grade?: {
        baseGrade: number | null;
        maxGrade: number | null;
        gradedAt?: string | null;
        feedback?: string | null;
    } | null;
};

export type DiscussionGradingStatus = "graded" | "partially-graded" | "not-graded";

type DiscussionGradingStats = {
    gradingStatus: DiscussionGradingStatus;
    gradedCount: number;
    totalPublishedCount: number;
    averageScore: number | null;
    maxGrade: number | null;
};

/**
 * Filters published submissions from a list of discussion submissions
 */
export function filterPublishedSubmissions<T extends DiscussionSubmission>(
    submissions: T[] | undefined,
): T[] {
    return submissions
        ? submissions.filter((sub) => sub.status === "published")
        : [];
}

/**
 * Calculates grading statistics for discussion submissions
 */
export function calculateDiscussionGradingStats<T extends DiscussionSubmission>(
    publishedSubmissions: T[],
): DiscussionGradingStats {
    // Filter graded submissions
    const gradedSubmissions = publishedSubmissions.filter(
        (sub) =>
            sub.grade &&
            sub.grade.baseGrade !== null &&
            sub.grade.baseGrade !== undefined,
    );
    const gradedCount = gradedSubmissions.length;
    const totalPublishedCount = publishedSubmissions.length;

    // Determine status: Graded, Partially Graded, or Not Graded
    let gradingStatus: DiscussionGradingStatus;
    if (gradedCount === 0) {
        gradingStatus = "not-graded";
    } else if (gradedCount === totalPublishedCount) {
        gradingStatus = "graded";
    } else {
        gradingStatus = "partially-graded";
    }

    // Calculate average score (only from graded posts)
    const totalScore = gradedSubmissions.reduce(
        (sum, sub) => sum + (sub.grade?.baseGrade || 0),
        0,
    );
    const averageScore = gradedCount > 0 ? totalScore / gradedCount : null;

    // Get maxGrade from first graded submission (all should have same maxGrade)
    const maxGrade =
        gradedSubmissions.length > 0 &&
            gradedSubmissions[0].grade?.maxGrade !== null &&
            gradedSubmissions[0].grade?.maxGrade !== undefined
            ? gradedSubmissions[0].grade.maxGrade
            : null;

    return {
        gradingStatus,
        gradedCount,
        totalPublishedCount,
        averageScore,
        maxGrade,
    };
}

/**
 * Groups discussion submissions by student ID and sorts them by date
 */
export function groupAndSortDiscussionSubmissions<T extends DiscussionSubmission & { student: { id: number } }>(
    submissions: T[],
): Map<number, T[]> {
    const submissionsByStudent = groupSubmissionsByStudent(submissions);

    // Sort submissions by date (newest first) for each student
    for (const [studentId, studentSubmissions] of submissionsByStudent) {
        submissionsByStudent.set(
            studentId,
            sortSubmissionsByDate(studentSubmissions),
        );
    }

    return submissionsByStudent;
}

/**
 * Gets the color for a discussion grading status badge
 */
export function getDiscussionGradingStatusColor(
    status: DiscussionGradingStatus,
): "green" | "yellow" | "gray" {
    switch (status) {
        case "graded":
            return "green";
        case "partially-graded":
            return "yellow";
        case "not-graded":
            return "gray";
    }
}

/**
 * Gets the label text for a discussion grading status
 */
export function getDiscussionGradingStatusLabel(
    status: DiscussionGradingStatus,
): string {
    switch (status) {
        case "graded":
            return "Graded";
        case "partially-graded":
            return "Partially Graded";
        case "not-graded":
            return "Not Graded";
    }
}

