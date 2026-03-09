import { Payload } from "payload";

/**
 * Drive Module
 * 
 * @upstream
 * - `user`: Drive storage is user-specific
 * 
 * @downstream None. Drive is a standalone storage feature.
 * 
 * Provides user media drive storage functionality.
 * Each user has a personal drive for storing files and media.
 */
export class DriveModule {
    private readonly payload: Payload;
    public static readonly moduleName = "drive" as const;
    public static readonly dependencies = ["user"] as const;
    public static readonly collections = [];
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
