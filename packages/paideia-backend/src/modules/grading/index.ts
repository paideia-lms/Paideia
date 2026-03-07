import { Gradebooks } from "server/collections";
import { GradebookCategories, GradebookItems } from "server/collections";

import { CollectionConfig, Payload } from "payload";

/**
 * Grading Module
 * 
 * @upstream
 * - `user`: Grading requires user context (graders and students)
 * - `infrastructure`: Uses infrastructure services for grade notifications
 * 
 * @downstream None. Grading is a cross-cutting concern that feeds into gradebooks.
 * 
 * Provides grading functionality across all activity types.
 * Centralizes grade calculation, storage, and management.
 */
export class GradingModule {
    private readonly payload: Payload;
    public static readonly moduleName = "grading" as const;
    public static readonly dependencies = ["user", "infrastructure"] as const;
    public static readonly collections: CollectionConfig[] = [];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = {};
    public static readonly queues = [];
    public static readonly tasks = [];
    public static readonly api = {};

    constructor(payload: Payload) {
        this.payload = payload;
    }

}