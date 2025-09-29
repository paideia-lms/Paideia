import { createContext } from "react-router";

export interface User {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    role?: ('student' | 'instructor' | 'admin') | null;
    bio?: string | null;
    avatar?: string | null;
    email: string;
    updatedAt: string;
    createdAt: string;
}

export interface UserSession {
    user: User;
    permissions: string[];
    isImpersonating: boolean;
    impersonatedBy?: User;
    isAuthenticated: boolean;
}

export const userContext = createContext<UserSession | null>(null);

export const userContextKey = "userContext" as unknown as typeof userContext;
