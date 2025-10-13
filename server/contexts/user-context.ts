import { createContext } from "react-router";
import type { User as PayloadUser } from "../payload-types";

export interface User {
	id: number;
	firstName?: string | null;
	lastName?: string | null;
	role?:
		| (
				| "student"
				| "instructor"
				| "admin"
				| "content-manager"
				| "analytics-viewer"
		  )
		| null;
	bio?: string | null;
	avatar?: number | PayloadUser["avatar"] | null;
	email: string;
	updatedAt: string;
	createdAt: string;
}

export interface UserSession {
	authenticatedUser: User; // The actual logged-in user (admin)
	effectiveUser: User | null; // The user being impersonated, or null when not impersonating
	authenticatedUserPermissions: string[]; // Permissions for authenticatedUser (admin's real permissions)
	effectiveUserPermissions: string[] | null; // Permissions for effectiveUser, or null when not impersonating
	isImpersonating: boolean; // true when admin is viewing as another user
	isAuthenticated: boolean;
}

export const userContext = createContext<UserSession | null>(null);

export const userContextKey = "userContext" as unknown as typeof userContext;
