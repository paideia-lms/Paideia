import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export const routes = [
	route("login", "routes/login.tsx"),
	route("first-user", "routes/first-user.tsx"),
	route("logout", "routes/logout.tsx"),
	route("api/stop-impersonation", "routes/api/stop-impersonation.tsx"),
	route("api/search-users", "routes/api/search-users.tsx"),
	route("api/media/file/:filename", "routes/api/media/file.$filename.tsx"),
	route("api/course-structure-tree", "routes/api/course-structure-tree.tsx"),
	layout("layouts/root-layout.tsx", [
		index("routes/index.tsx"),
		route("user/profile/:id?", "routes/user/profile.tsx"),
		route("user/edit/:id?", "routes/user/edit.tsx"),
		route("user/modules/:id?", "routes/user/modules.tsx"),
		route("user/notes/:id?", "routes/user/notes.tsx"),
		route("user/note/create", "routes/user/note-create.tsx"),
		route("user/note/edit/:id", "routes/user/note-edit.tsx"),
		route("user/module/new", "routes/user/module/new.tsx"),
		route("user/module/edit/:id", "routes/user/module/edit.tsx"),
		route("course/new", "routes/course-new.tsx"),
		route("course", "routes/course.tsx"),
		layout("layouts/course-layout.tsx", [
			layout("layouts/course-content-layout.tsx", [
				route("course/:id", "routes/course.$id.tsx"),
				route("course/module/:id", "routes/course/module.$id.tsx"),
				route("course/section/:id", "routes/course/section.$id.tsx"),
			]),
			route("course/:id/settings", "routes/course.$id.settings.tsx"),
			route("course/:id/participants", "routes/course.$id.participants.tsx"),
			route("course/:id/grades", "routes/course.$id.grades.tsx"),
			route("course/:id/modules", "routes/course.$id.modules.tsx"),
			route("course/:id/bin", "routes/course.$id.bin.tsx"),
			route("course/:id/backup", "routes/course.$id.backup.tsx"),
		]),
		layout("layouts/server-admin-layout.tsx", [
			route("admin/*", "routes/admin/index.tsx"),
			route("admin/users", "routes/admin/users.tsx"),
			route("admin/user/new", "routes/admin/new.tsx"),
			route("admin/courses", "routes/admin/courses.tsx"),
		]),
	]),
] as const satisfies RouteConfig;

export default routes;
