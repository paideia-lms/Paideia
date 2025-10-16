// TODO: Update this file to use the new course-sections system
// This file previously managed course structure using a JSON field
// Now it needs to be updated to work with the course-sections collection

import { badRequest } from "~/utils/responses";
import type { Route } from "./+types/course-structure-tree";

export const action = async ({ request, context }: Route.ActionArgs) => {
    // TODO: Implement using new course-sections system
    return badRequest({ error: "Course structure tree API temporarily disabled - needs update for new sections system" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    // TODO: Implement using new course-sections system
    return { success: false, error: "Course structure tree API temporarily disabled" };
}
