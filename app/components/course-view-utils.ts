import type { Course } from "server/payload-types";

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

export const getTypeLabel = (type: string) => {
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

export const getRoleBadgeColor = (role: string) => {
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

export const getRoleLabel = (role: string) => {
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

export const getEnrollmentStatusBadgeColor = (status: string) => {
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

export const getEnrollmentStatusLabel = (status: string) => {
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
