import { Payload } from "payload";


export class DriveModule {
    private readonly payload: Payload;
    public static readonly moduleName = "drive" as const;
    public static readonly dependencies = ["user"] as const;
    public static readonly collections = [

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