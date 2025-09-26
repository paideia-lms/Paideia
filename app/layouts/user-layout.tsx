import { Outlet } from "react-router";
import { dbContextKey } from "server/global-context";
import { UnauthorizedResponse } from "~/utils/responses";
import { Route } from "./+types/user-layout";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
    const payload = context.get(dbContextKey).payload;
    const { user, responseHeaders, permissions } = await payload.auth({ headers: request.headers, canSetHeaders: true })

    if (!user) {
        throw new UnauthorizedResponse("Unauthorized")
    }
    return {
        user
    }
}

export default function UserLayout() {
    return (
        <div>
            <div>User Layout</div>
            <Outlet />
        </div>
    )
}