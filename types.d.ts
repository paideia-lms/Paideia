import { Database } from "bun:sqlite"

declare module "*.png" {
    const content: string;
    export default content;
}

declare module "*.jpg" {
    const content: string;
    export default content;
}

declare module "*.db" {
    const db: Database;
    export default db;
}
