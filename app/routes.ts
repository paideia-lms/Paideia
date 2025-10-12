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
	route("api/media/file/:filename", "routes/api/media/file.$filename.tsx"),
	layout("layouts/user-layout.tsx", [
		route("user/profile/:id?", "routes/user/profile.tsx"),
		route("user/edit/:id?", "routes/user/edit.tsx"),
		route("user/notes/:id?", "routes/user/notes.tsx"),
		route("user/note/create", "routes/user/note-create.tsx"),
		route("user/note/edit/:id", "routes/user/note-edit.tsx"),
		route("user/module/new", "routes/user/module/new.tsx"),
		layout("layouts/course-layout.tsx", [route("course", "routes/course.tsx")]),
		layout("layouts/server-admin-layout.tsx", [
			route("admin/*", "routes/admin/index.tsx"),
			route("admin/users", "routes/admin/users.tsx"),
			route("admin/user/new", "routes/admin/new.tsx"),
		]),
	]),
] satisfies RouteConfig;
