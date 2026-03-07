import { Files } from "server/collections";

export class FilesModule {
    public static readonly moduleName = "files" as const;
    public static readonly dependencies = ["courses"] as const;
    public static readonly collections = [Files];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = [];
    public static readonly queues = [];
    public static readonly tasks = [];
    public static readonly api = {};
}