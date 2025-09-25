import { index, route, type RouteConfig } from "@react-router/dev/routes";


export default [
    index("routes/index.tsx"),
    route("login", "routes/login.tsx"),
    route("first-user", "routes/first-user.tsx"),
    route("logout", "routes/logout.tsx"),
    route("api/system/swagger", "routes/api/swagger.tsx"),
    route("admin/*", "routes/admin.tsx"),
] satisfies RouteConfig;
