import { dbContextKey } from "server/db-context";
import type { Route } from "./+types/$"

const handler = async ({ request, context }: Route.LoaderArgs) => {
    // const app = context.get(dbContextKey).app;
    // return app.fetch(request);
    throw new Error("Not implemented");
};

export const loader = handler;
export const action = handler;