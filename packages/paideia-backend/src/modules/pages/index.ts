import { Pages } from "server/collections";
import { Payload } from "payload";
export class PagesModule {
    private readonly payload: Payload;
    public static readonly collections = [
        Pages,
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