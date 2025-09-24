import { dbContextKey } from "server/db-context";
import type { Route } from "./+types/$"

const handler = async ({ request, context }: Route.LoaderArgs) => {
    console.log("hit", request)
    const app = context.get(dbContextKey).app;
    return app.fetch(request);
};

export const loader = handler;
export const action = handler;