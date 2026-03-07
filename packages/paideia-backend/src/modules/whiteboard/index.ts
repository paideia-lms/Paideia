import { CollectionConfig, Payload, TaskConfig } from "payload";
import { Whiteboards } from "server/collections";

export class WhiteboardModule {
    private readonly payload: Payload;
    public static readonly moduleName = "whiteboard" as const;
    public static readonly dependencies = ["courses"] as const;
    public static readonly collections = [Whiteboards];
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