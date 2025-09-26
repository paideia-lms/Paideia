import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";


export default [
    index("routes/index.tsx"),
    route("login", "routes/login.tsx"),
    route("first-user", "routes/first-user.tsx"),
    route("logout", "routes/logout.tsx"),
    route("api/system/swagger", "routes/api/swagger.tsx"),
    layout("layouts/user-layout.tsx", [
        layout("layouts/course-layout.tsx", [

        ]),
        layout("layouts/server-admin-layout.tsx", [
            route("admin/*", "routes/admin/index.tsx"),
        ]),
    ]),
] satisfies RouteConfig;
