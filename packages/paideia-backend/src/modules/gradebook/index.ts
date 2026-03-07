import { Gradebooks } from "server/collections";
import { GradebookCategories, GradebookItems } from "server/collections";

import { Payload } from "payload";
export class GradebookModule {
    private readonly payload: Payload;
    public static readonly collections = [
        Gradebooks,
        GradebookCategories,
        GradebookItems,
    ];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = {};
    public static readonly queues = [];
    public static readonly tasks = [];
    public static readonly api = {
    }
    constructor(payload: Payload) {
        this.payload = payload;
    }
}