import { createContext } from "react-router";

export interface Course {
    id: number;
    title: string;
    description: string;
    instructor: number;
    difficulty?: ('beginner' | 'intermediate' | 'advanced') | null;
    duration?: number | null;
    status?: ('draft' | 'published' | 'archived') | null;
    thumbnail?: string | null;
    tags?: Array<{ tag?: string | null; id?: string | null }>;
    updatedAt: string;
    createdAt: string;
}

export interface CourseContext {
    course: Course;
    courseId: string;
}

export const courseContext = createContext<CourseContext | null>(null);

export const courseContextKey = "courseContext" as unknown as typeof courseContext;
