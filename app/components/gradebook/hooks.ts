import { href, useFetcher } from "react-router";
import { ContentType } from "~/utils/get-content-type";
import type { clientAction } from "~/routes/course.$id.grades";

export function useCreateGradeItem() {
    const fetcher = useFetcher<typeof clientAction>();

    const createGradeItem = (courseId: number, values: {
        name: string;
        description?: string;
        categoryId?: number | null;
        maxGrade?: number;
        minGrade?: number;
        weight?: number;
        extraCredit?: boolean;
    }) => {
        const submissionData = {
            intent: "create-item" as const,
            ...values,
        };
        fetcher.submit(submissionData, {
            method: "POST",
            encType: ContentType.JSON,
            action: href("/course/:id/grades", { id: courseId.toString() }),
        });
    };

    return {
        createGradeItem,
        isLoading: fetcher.state !== "idle",
        data: fetcher.data,
    };
}

export function useCreateCategory() {
    const fetcher = useFetcher<typeof clientAction>();

    const createCategory = (values: {
        name: string;
        description?: string;
        parentId?: number | null;
        weight?: number;
    }) => {
        const submissionData = {
            intent: "create-category" as const,
            ...values,
        };
        fetcher.submit(submissionData, {
            method: "POST",
            encType: ContentType.JSON,
        });
    };

    return {
        createCategory,
        isLoading: fetcher.state !== "idle",
        data: fetcher.data,
    };
}

export function useUpdateGradeItem() {
    const fetcher = useFetcher<typeof clientAction>();

    const updateGradeItem = (courseId: number, itemId: number, values: {
        name?: string;
        description?: string;
        maxGrade?: number;
        minGrade?: number;
        weight?: number;
        extraCredit?: boolean;
    }) => {
        const submissionData = {
            intent: "update-item" as const,
            itemId,
            ...values,
        };
        fetcher.submit(submissionData, {
            method: "POST",
            encType: ContentType.JSON,
            action: href("/course/:id/grades", { id: courseId.toString() }),
        });
    };

    return {
        updateGradeItem,
        isLoading: fetcher.state !== "idle",
        data: fetcher.data,
    };
}

export function useUpdateGradeCategory() {
    const fetcher = useFetcher<typeof clientAction>();

    const updateGradeCategory = (categoryId: number, values: {
        name?: string;
        description?: string;
        weight?: number;
    }) => {
        const submissionData = {
            intent: "update-category" as const,
            categoryId,
            ...values,
        };
        fetcher.submit(submissionData, {
            method: "POST",
            encType: ContentType.JSON,
        });
    };

    return {
        updateGradeCategory,
        isLoading: fetcher.state !== "idle",
        data: fetcher.data,
    };
}

