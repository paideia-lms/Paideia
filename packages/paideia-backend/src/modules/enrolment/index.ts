import { Payload } from "payload";
export class EnrolmentModule {
    private readonly payload: Payload;
    public static readonly moduleName = "enrolment" as const;
    public static readonly dependencies = ["courses"] as const;
    public static readonly collections = [
    ];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = {};
    public static readonly queues = [];
    public static readonly tasks = [];

    constructor(payload: Payload) {
        this.payload = payload;
    }
}