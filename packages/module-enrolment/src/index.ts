import { Payload } from "payload";
import packageJson from "../package.json";
import { Enrollments } from "./collections/enrollments";
import { Groups } from "./collections/groups";
import {
	type CreateEnrollmentArgs,
	tryCreateEnrollment,
	type UpdateEnrollmentArgs,
	tryUpdateEnrollment,
	type FindEnrollmentByIdArgs,
	tryFindEnrollmentById,
	type SearchEnrollmentsArgs,
	trySearchEnrollments,
	type DeleteEnrollmentArgs,
	tryDeleteEnrollment,
	type FindEnrollmentsByUserArgs,
	tryFindEnrollmentsByUser,
	type FindEnrollmentsByCourseArgs,
	tryFindEnrollmentsByCourse,
	type FindUserEnrollmentInCourseArgs,
	tryFindUserEnrollmentInCourse,
	type FindActiveEnrollmentsArgs,
	tryFindActiveEnrollments,
	type UpdateEnrollmentStatusArgs,
	tryUpdateEnrollmentStatus,
	type AddGroupsToEnrollmentArgs,
	tryAddGroupsToEnrollment,
	type RemoveGroupsFromEnrollmentArgs,
	tryRemoveGroupsFromEnrollment,
	type FindEnrollmentsByGroupArgs,
	tryFindEnrollmentsByGroup,
} from "./services/enrollment-management";
import {
	type CreateGroupArgs,
	tryCreateGroup,
	type UpdateGroupArgs,
	tryUpdateGroup,
	type DeleteGroupArgs,
	tryDeleteGroup,
	type FindGroupByIdArgs,
	tryFindGroupById,
	type FindGroupsByCourseArgs,
	tryFindGroupsByCourse,
	type FindGroupByPathArgs,
	tryFindGroupByPath,
	type FindChildGroupsArgs,
	tryFindChildGroups,
	type FindRootGroupsArgs,
	tryFindRootGroups,
} from "./services/group-management";
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
} from "./api/enrollment-management";

/**
 * Enrolment Module
 * 
 * @upstream
 * - `courses`: Cannot enroll without an existing course
 * - `user`: Required for enrollment user relationships
 * 
 * @downstream
 * - `gradebook`: Gradebooks are created for course enrolments
 * - `grading`: Grading is tied to enrolments
 * 
 * Provides course enrollment management functionality.
 * Students enroll in courses with specific roles (student, teacher, TA).
 * Groups organize enrollments within courses with hierarchical nesting.
 */
export class EnrolmentModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(packageJson.dependencies);
	public static readonly collections = [Enrollments, Groups];
	public static readonly cli = {};
	public static readonly search = [];
	public static readonly seedData = {};
	public static readonly queues = [];
	public static readonly tasks = [];
	public static readonly api = {
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
	};

	constructor(payload: Payload) {
		this.payload = payload;
	}

	// Enrollment methods
	createEnrollment(args: Omit<CreateEnrollmentArgs, "payload">) {
		return tryCreateEnrollment({ payload: this.payload, ...args });
	}

	updateEnrollment(args: Omit<UpdateEnrollmentArgs, "payload">) {
		return tryUpdateEnrollment({ payload: this.payload, ...args });
	}

	findEnrollmentById(args: Omit<FindEnrollmentByIdArgs, "payload">) {
		return tryFindEnrollmentById({ payload: this.payload, ...args });
	}

	searchEnrollments(args: Omit<SearchEnrollmentsArgs, "payload">) {
		return trySearchEnrollments({ payload: this.payload, ...args });
	}

	deleteEnrollment(args: Omit<DeleteEnrollmentArgs, "payload">) {
		return tryDeleteEnrollment({ payload: this.payload, ...args });
	}

	findEnrollmentsByUser(args: Omit<FindEnrollmentsByUserArgs, "payload">) {
		return tryFindEnrollmentsByUser({ payload: this.payload, ...args });
	}

	findEnrollmentsByCourse(args: Omit<FindEnrollmentsByCourseArgs, "payload">) {
		return tryFindEnrollmentsByCourse({ payload: this.payload, ...args });
	}

	findUserEnrollmentInCourse(args: Omit<FindUserEnrollmentInCourseArgs, "payload">) {
		return tryFindUserEnrollmentInCourse({ payload: this.payload, ...args });
	}

	findActiveEnrollments(args: Omit<FindActiveEnrollmentsArgs, "payload">) {
		return tryFindActiveEnrollments({ payload: this.payload, ...args });
	}

	updateEnrollmentStatus(args: Omit<UpdateEnrollmentStatusArgs, "payload">) {
		return tryUpdateEnrollmentStatus({ payload: this.payload, ...args });
	}

	addGroupsToEnrollment(args: Omit<AddGroupsToEnrollmentArgs, "payload">) {
		return tryAddGroupsToEnrollment({ payload: this.payload, ...args });
	}

	removeGroupsFromEnrollment(args: Omit<RemoveGroupsFromEnrollmentArgs, "payload">) {
		return tryRemoveGroupsFromEnrollment({ payload: this.payload, ...args });
	}

	findEnrollmentsByGroup(args: Omit<FindEnrollmentsByGroupArgs, "payload">) {
		return tryFindEnrollmentsByGroup({ payload: this.payload, ...args });
	}

	// Group methods
	createGroup(args: Omit<CreateGroupArgs, "payload">) {
		return tryCreateGroup({ payload: this.payload, ...args });
	}

	updateGroup(args: Omit<UpdateGroupArgs, "payload">) {
		return tryUpdateGroup({ payload: this.payload, ...args });
	}

	deleteGroup(args: Omit<DeleteGroupArgs, "payload">) {
		return tryDeleteGroup({ payload: this.payload, ...args });
	}

	findGroupById(args: Omit<FindGroupByIdArgs, "payload">) {
		return tryFindGroupById({ payload: this.payload, ...args });
	}

	findGroupsByCourse(args: Omit<FindGroupsByCourseArgs, "payload">) {
		return tryFindGroupsByCourse({ payload: this.payload, ...args });
	}

	findGroupByPath(args: Omit<FindGroupByPathArgs, "payload">) {
		return tryFindGroupByPath({ payload: this.payload, ...args });
	}

	findChildGroups(args: Omit<FindChildGroupsArgs, "payload">) {
		return tryFindChildGroups({ payload: this.payload, ...args });
	}

	findRootGroups(args: Omit<FindRootGroupsArgs, "payload">) {
		return tryFindRootGroups({ payload: this.payload, ...args });
	}
}
