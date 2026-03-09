import { Payload } from "payload";
import { Discussions } from "server/collections";

/**
 * Discussion Module
 * 
 * @upstream
 * - `user`: Discussions require users for authors, replies
 * - `infrastructure`: Uses infrastructure services for notifications
 * - `courses`: Discussions are course activities and must be linked to existing courses
 * 
 * @downstream
 * - `gradebook`: Discussion grades are tracked in gradebooks
 * 
 * Provides discussion forum functionality for courses.
 * Discussions are course activity modules for threaded conversations and replies.
 */
export class DiscussionModule {
    private readonly payload: Payload;
    public static readonly moduleName = "discussion" as const;
    public static readonly dependencies = ["user", "infrastructure", "courses"] as const;
    public static readonly collections = [
        Discussions,
    ];
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