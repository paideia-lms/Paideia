import { healthCheck, ping } from "../modules/infrastructure/api/health";
import { getSystemGlobals } from "./routers/system-globals";
import { getLatestVersion } from "../modules/infrastructure/api/version-management";
import {
	createCourse,
	updateCourse,
	findCourseById,
	searchCourses,
	findPublishedCourses,
	deleteCourse,
	findCoursesByInstructor,
	findAllCourses,
} from "../modules/courses/api/course-management";
import {
	findUserById,
	findUserByEmail,
	findAllUsers,
} from "../modules/user/api/user-management";
import {
	createEnrollment,
	updateEnrollment,
	findEnrollmentById,
	searchEnrollments,
	deleteEnrollment,
	findEnrollmentsByUser,
	findEnrollmentsByCourse,
	findUserEnrollmentInCourse,
	findActiveEnrollments,
	updateEnrollmentStatus,
	addGroupsToEnrollment,
	removeGroupsFromEnrollment,
	findEnrollmentsByGroup,
} from "./routers/enrollment-management";
import {
	createNote,
	updateNote,
	findNoteById,
	searchNotes,
	deleteNote,
	findNotesByUser,
	generateNoteHeatmap,
} from "../modules/note/api/note-management";
import {
	createCategory,
	updateCategory,
	deleteCategory,
	findCategoryById,
	getCategoryTree,
	getCategoryAncestors,
	getCategoryDepth,
	getTotalNestedCoursesCount,
	findRootCategories,
	findSubcategories,
	findAllCategories,
} from "./routers/course-category-management";
import {
	getAnalyticsSettings,
	updateAnalyticsSettings,
	getAppearanceSettings,
	updateAppearanceSettings,
	getMaintenanceSettings,
	updateMaintenanceSettings,
	getRegistrationSettings,
	updateRegistrationSettings,
	getSitePolicies,
	updateSitePolicies,
} from "./routers/settings";
import {
	grantAccess,
	revokeAccess,
	findGrantsByActivityModule,
	findInstructorsForActivityModule,
	findAutoGrantedModulesForInstructor,
} from "./routers/activity-module-access";
import {
	getCronJobs,
	getCronJobHistory,
	getPendingJobsByQueue,
} from "../modules/infrastructure/api/cron-jobs-management";
import {
	getScheduledTasks,
	getPendingScheduledTasks,
} from "../modules/infrastructure/api/scheduled-tasks-management";
import { globalSearch } from "./routers/search-management";
import {
	getMediaById,
	getMediaByFilenames,
	getMediaByIds,
	getAllMedia,
	deleteMedia,
	getMediaByMimeType,
	findMediaByUser,
	renameMedia,
	getUserMediaStats,
	getSystemMediaStats,
	getOrphanedMedia,
	getAllOrphanedFilenames,
	findMediaUsages,
} from "../modules/user/api/media-management";
import {
	createGradebook,
	updateGradebook,
	getGradebookByCourseWithDetails,
	getGradebookAllRepresentations,
} from "./routers/gradebook-management";
import {
	createSection,
	updateSection,
	findSectionById,
	deleteSection,
	findSectionsByCourse,
	findRootSections,
	findChildSections,
	getSectionTree,
	getSectionAncestors,
	getSectionDepth,
} from "../modules/courses/api/course-section-management";
import {
	createCourseActivityModuleLink,
	findLinksByCourse,
	findLinksByActivityModule,
	searchCourseActivityModuleLinks,
	deleteCourseActivityModuleLink,
	findCourseActivityModuleLinkById,
	getCourseModuleSettings,
	checkCourseActivityModuleLinkExists,
} from "../modules/courses/api/course-activity-module-link-management";
import {
	createDiscussionSubmission,
	updateDiscussionSubmission,
	getDiscussionSubmissionById,
	getDiscussionThreadsWithAllReplies,
	getDiscussionThreadWithReplies,
	upvoteDiscussionSubmission,
	removeUpvoteDiscussionSubmission,
	listDiscussionSubmissions,
	gradeDiscussionSubmission,
	deleteDiscussionSubmission,
} from "./routers/discussion-management";
import {
	createAssignmentSubmission,
	getAssignmentSubmissionById,
	gradeAssignmentSubmission,
	removeAssignmentSubmissionGrade,
	listAssignmentSubmissions,
	deleteAssignmentSubmission,
} from "./routers/assignment-submission-management";
import {
	getQuizById,
	getQuizSubmissionById,
	listQuizSubmissions,
	startQuizAttempt,
	startPreviewQuizAttempt,
	getQuizGradesReport,
	getQuizStatisticsReport,
	getNextAttemptNumber,
	checkInProgressSubmission,
} from "./routers/quiz-submission-management";
import { os } from "@orpc/server";
import type { OrpcContext } from "./context";
import { requireAuth } from "./middleware/auth";

const baseRouter = {
	health: {
		check: healthCheck,
		ping,
	},
	systemGlobals: {
		get: getSystemGlobals,
	},
	version: {
		getLatest: getLatestVersion,
	},
	courses: {
		create: createCourse,
		update: updateCourse,
		findById: findCourseById,
		search: searchCourses,
		findPublished: findPublishedCourses,
		delete: deleteCourse,
		findByInstructor: findCoursesByInstructor,
		findAll: findAllCourses,
	},
	users: {
		findById: findUserById,
		findByEmail: findUserByEmail,
		findAll: findAllUsers,
	},
	enrollments: {
		create: createEnrollment,
		update: updateEnrollment,
		findById: findEnrollmentById,
		search: searchEnrollments,
		delete: deleteEnrollment,
		findByUser: findEnrollmentsByUser,
		findByCourse: findEnrollmentsByCourse,
		findUserInCourse: findUserEnrollmentInCourse,
		findActive: findActiveEnrollments,
		updateStatus: updateEnrollmentStatus,
		addGroups: addGroupsToEnrollment,
		removeGroups: removeGroupsFromEnrollment,
		findByGroup: findEnrollmentsByGroup,
	},
	notes: {
		create: createNote,
		update: updateNote,
		findById: findNoteById,
		search: searchNotes,
		delete: deleteNote,
		findByUser: findNotesByUser,
		generateHeatmap: generateNoteHeatmap,
	},
	courseCategories: {
		create: createCategory,
		update: updateCategory,
		delete: deleteCategory,
		findById: findCategoryById,
		getTree: getCategoryTree,
		getAncestors: getCategoryAncestors,
		getDepth: getCategoryDepth,
		getTotalNestedCoursesCount,
		findRoots: findRootCategories,
		findSubcategories,
		findAll: findAllCategories,
	},
	settings: {
		getAnalytics: getAnalyticsSettings,
		updateAnalytics: updateAnalyticsSettings,
		getAppearance: getAppearanceSettings,
		updateAppearance: updateAppearanceSettings,
		getMaintenance: getMaintenanceSettings,
		updateMaintenance: updateMaintenanceSettings,
		getRegistration: getRegistrationSettings,
		updateRegistration: updateRegistrationSettings,
		getSitePolicies,
		updateSitePolicies,
	},
	activityModuleAccess: {
		grant: grantAccess,
		revoke: revokeAccess,
		findGrantsByActivityModule,
		findInstructorsForActivityModule,
		findAutoGrantedModulesForInstructor,
	},
	cronJobs: {
		getAll: getCronJobs,
		getHistory: getCronJobHistory,
		getPendingByQueue: getPendingJobsByQueue,
	},
	scheduledTasks: {
		getAll: getScheduledTasks,
		getPending: getPendingScheduledTasks,
	},
	search: {
		global: globalSearch,
	},
	media: {
		getById: getMediaById,
		getByFilenames: getMediaByFilenames,
		getByIds: getMediaByIds,
		getAll: getAllMedia,
		delete: deleteMedia,
		getByMimeType: getMediaByMimeType,
		findByUser: findMediaByUser,
		rename: renameMedia,
		getUserStats: getUserMediaStats,
		getSystemStats: getSystemMediaStats,
		getOrphaned: getOrphanedMedia,
		getAllOrphanedFilenames,
		findUsages: findMediaUsages,
	},
	gradebooks: {
		create: createGradebook,
		update: updateGradebook,
		getByCourseWithDetails: getGradebookByCourseWithDetails,
		getAllRepresentations: getGradebookAllRepresentations,
	},
	courseSections: {
		create: createSection,
		update: updateSection,
		findById: findSectionById,
		delete: deleteSection,
		findByCourse: findSectionsByCourse,
		findRoots: findRootSections,
		findChildren: findChildSections,
		getTree: getSectionTree,
		getAncestors: getSectionAncestors,
		getDepth: getSectionDepth,
	},
	courseActivityModuleLinks: {
		create: createCourseActivityModuleLink,
		findByCourse: findLinksByCourse,
		findByActivityModule: findLinksByActivityModule,
		search: searchCourseActivityModuleLinks,
		delete: deleteCourseActivityModuleLink,
		findById: findCourseActivityModuleLinkById,
		getSettings: getCourseModuleSettings,
		checkExists: checkCourseActivityModuleLinkExists,
	},
	discussions: {
		create: createDiscussionSubmission,
		update: updateDiscussionSubmission,
		getById: getDiscussionSubmissionById,
		getThreadsWithReplies: getDiscussionThreadsWithAllReplies,
		getThreadWithReplies: getDiscussionThreadWithReplies,
		upvote: upvoteDiscussionSubmission,
		removeUpvote: removeUpvoteDiscussionSubmission,
		list: listDiscussionSubmissions,
		grade: gradeDiscussionSubmission,
		delete: deleteDiscussionSubmission,
	},
	assignmentSubmissions: {
		create: createAssignmentSubmission,
		getById: getAssignmentSubmissionById,
		grade: gradeAssignmentSubmission,
		removeGrade: removeAssignmentSubmissionGrade,
		list: listAssignmentSubmissions,
		delete: deleteAssignmentSubmission,
	},
	quizSubmissions: {
		getQuizById,
		getById: getQuizSubmissionById,
		list: listQuizSubmissions,
		startAttempt: startQuizAttempt,
		startPreviewAttempt: startPreviewQuizAttempt,
		getGradesReport: getQuizGradesReport,
		getStatisticsReport: getQuizStatisticsReport,
		getNextAttemptNumber,
		checkInProgress: checkInProgressSubmission,
	},
};

export const orpcRouter = os
	.$context<OrpcContext>()
	.use(requireAuth)
	.router(baseRouter);
