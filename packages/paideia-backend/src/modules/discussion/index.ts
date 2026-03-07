import { Payload } from "payload";
import { Discussions } from "server/collections";

export class DiscussionModule {
    private readonly payload: Payload;
    public static readonly moduleName = "discussion" as const;
    public static readonly dependencies = ["user", "infrastructure"] as const;
    public static readonly collections = [];
    public static readonly cli = {};
    public static readonly search = [
        Discussions.slug,
    ];
    public static readonly seedData = {};
    public static readonly queues = [];
    public static readonly tasks = [];
    public static readonly api = {};
    constructor(payload: Payload) {
        this.payload = payload;
    }
}