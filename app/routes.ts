import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	index("routes/index.tsx"),
	route("login", "routes/login.tsx"),
	route("first-user", "routes/first-user.tsx"),
	route("logout", "routes/logout.tsx"),
	route("api/system/swagger", "routes/api/swagger.tsx"),
	route("api/media/file/:filename", "routes/api/media/file.$filename.tsx"),
	layout("layouts/user-layout.tsx", [
		route("user/profile", "routes/user/profile.tsx"),
		route("user/edit", "routes/user/edit.tsx"),
		layout("layouts/course-layout.tsx", [route("course", "routes/course.tsx")]),
		layout("layouts/server-admin-layout.tsx", [
			route("admin/*", "routes/admin/index.tsx"),
		]),
	]),
] satisfies RouteConfig;
