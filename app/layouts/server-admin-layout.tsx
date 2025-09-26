import { Outlet, useLocation } from "react-router";
import { dbContextKey } from "server/global-context";
import { Route } from "./+types/server-admin-layout";
import { UnauthorizedResponse } from "~/utils/responses";


export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const payload = context.get(dbContextKey).payload;
  const { user, responseHeaders, permissions } = await payload.auth({ headers: request.headers, canSetHeaders: true })

  if (!user || user.role !== "admin") {
    throw new UnauthorizedResponse("Unauthorized")
  }
  return { user }
}


export default function ServerAdminLayout() {
  const location = useLocation();

  return <div>
    Admin
    <Outlet />
  </div>
}