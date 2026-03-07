import { Payload } from "payload";

export class AssignmentModule {
    private readonly payload: Payload;
    public static readonly moduleName = "assignment" as const;
    public static readonly dependencies = [];
    public static readonly collections = [];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = [];
    public static readonly queues = [];
    public static readonly tasks = [];
    public static readonly api = {};

    constructor(payload: Payload) {
        this.payload = payload;
    }
}