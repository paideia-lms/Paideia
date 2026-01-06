import type {
	ActivityModule,
	Course,
	Enrollment,
	User,
} from "server/payload-types";

export const getStatusBadgeColor = (status: Course["status"]) => {
	switch (status) {
		case "published":
			return "green";
		case "draft":
			return "yellow";
		case "archived":
			return "gray";
		default:
			return "gray";
	}
};

export const getStatusLabel = (status: Course["status"]) => {
	switch (status) {
		case "published":
			return "Published";
		case "draft":
			return "Draft";
		case "archived":
			return "Archived";
		default:
			return status;
	}
};

export const getTypeLabel = (type: ActivityModule["type"]) => {
	switch (type) {
		case "page":
			return "Page";
		case "whiteboard":
			return "Whiteboard";
		case "assignment":
			return "Assignment";
		case "quiz":
			return "Quiz";
		case "discussion":
			return "Discussion";
		default:
			return type;
	}
};

export const getEnrolmentRoleBadgeColor = (role: Enrollment["role"]) => {
	switch (role) {
		case "student":
			return "blue";
		case "teacher":
			return "green";
		case "ta":
			return "yellow";
		case "manager":
			return "purple";
		default:
			return "gray";
	}
};

export const getRoleLabel = (role: Enrollment["role"]) => {
	switch (role) {
		case "student":
			return "Student";
		case "teacher":
			return "Teacher";
		case "ta":
			return "Teaching Assistant";
		case "manager":
			return "Manager";
		default:
			return role;
	}
};

export const getEnrollmentStatusBadgeColor = (status: Enrollment["status"]) => {
	switch (status) {
		case "active":
			return "green";
		case "inactive":
			return "gray";
		case "completed":
			return "blue";
		case "dropped":
			return "red";
		default:
			return "gray";
	}
};

export const getEnrollmentStatusLabel = (status: Enrollment["status"]) => {
	switch (status) {
		case "active":
			return "Active";
		case "inactive":
			return "Inactive";
		case "completed":
			return "Completed";
		case "dropped":
			return "Dropped";
		default:
			return status;
	}
};

export const getUserRoleBadgeColor = (role: User["role"]) => {
	switch (role) {
		case "admin":
			return "red";
		case "content-manager":
			return "blue";
		case "analytics-viewer":
			return "green";
		default:
			return "gray";
	}
};

export const getUserRoleLabel = (role: User["role"]) => {
	switch (role) {
		case "admin":
			return "Admin";
		case "content-manager":
			return "Content Manager";
		case "analytics-viewer":
			return "Analytics Viewer";
		default:
			return "User";
	}
};
