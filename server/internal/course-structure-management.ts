import type { Payload, PayloadRequest } from "payload";
import { Result } from "typescript-result";
import { courseStructureSchema } from "server/utils/schema";
import { tryUpdateCourse } from "./course-management";
import {
    InvalidArgumentError,
    TransactionIdNotFoundError,
    transformError,
    UnknownError,
} from "~/utils/error";
import type { User } from "../payload-types";

export interface UpdateCourseStructureArgs {
    payload: Payload;
    courseId: number;
    newStructure: unknown; // Will be validated against courseStructureSchema
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

/**
 * Updates the course structure JSON field in the database
 * Validates the structure against the schema and uses transactions for safety
 */
export const tryUpdateCourseStructure = Result.wrap(
    async (args: UpdateCourseStructureArgs) => {
        const {
            payload,
            courseId,
            newStructure,
            user,
            req,
            overrideAccess = false,
        } = args;

        if (!courseId) {
            throw new InvalidArgumentError("Course ID is required");
        }

        // Validate the structure against the schema
        const validationResult = courseStructureSchema.safeParse(newStructure);
        if (!validationResult.success) {
            throw new InvalidArgumentError(
                `Invalid course structure: ${validationResult.error.message}`,
            );
        }

        const validatedStructure = validationResult.data;

        // Start transaction
        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Update the course with the new structure
            const updateResult = await tryUpdateCourse({
                payload,
                courseId,
                data: {
                    structure: validatedStructure,
                },
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            if (!updateResult.ok) {
                await payload.db.rollbackTransaction(transactionID);
                throw new Error(updateResult.error.message);
            }

            // Commit the transaction
            await payload.db.commitTransaction(transactionID);

            return updateResult.value;
        } catch (error) {
            // Rollback transaction on error
            await payload.db.rollbackTransaction(transactionID);
            throw error;
        }
    },
    (error) =>
        transformError(error) ??
        new UnknownError("Failed to update course structure", {
            cause: error,
        }),
);
