import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export const routes = [
	route("login", "routes/login.tsx"),
	route("registration", "routes/registration.tsx"),
	route("logout", "routes/logout.tsx"),
	route("api/stop-impersonation", "routes/api/stop-impersonation.tsx"),
	route("api/search-users", "routes/api/search-users.tsx"),
	route(
		"api/media/file/:filenameOrId",
		"routes/api/media/file.$filenameOrId.tsx",
	),
	route("api/user/:id/avatar", "routes/api/user.$id.avatar.tsx"),
	route("api/d2-render", "routes/api/d2-render.tsx"),
	route("api/course-structure-tree", "routes/api/course-structure-tree.tsx"),
	route("api/batch-update-courses", "routes/api/batch-update-courses.tsx"),
	route("api/category-reorder", "routes/api/category-reorder.tsx"),
	route("api/section-delete", "routes/api/section-delete.tsx"),
	route("api/section-update", "routes/api/section-update.tsx"),
	layout("layouts/root-layout.tsx", [
		index("routes/index.tsx"),
		route("catalog", "routes/catalog.tsx"),
		// every user will see this page the same except some permission difference
		route("user/profile/:id?", "routes/user/profile.tsx"),
		// this should belong to user data management
		layout("layouts/user-layout.tsx", [
			route("user/overview/:id?", "routes/user/overview.tsx"),
			route("user/preference/:id?", "routes/user/preference.tsx"),
			route("user/grades/:id?", "routes/user/grades.tsx"),
			route("user/notes/:id?", "routes/user/notes.tsx"),
			route("user/note/create", "routes/user/note-create.tsx"),
			route("user/note/edit/:id", "routes/user/note-edit.tsx"),
			route("user/media/:id?", "routes/user/media.tsx"),
			layout("layouts/user-modules-layout.tsx", [
				//  the id is the user id
				route("user/modules/:id?", "routes/user/modules.tsx"),
				route("user/module/new", "routes/user/module/new.tsx"),
				layout("layouts/user-module-edit-layout.tsx", [
					route("user/module/edit/:moduleId", "routes/user/module/edit.tsx"),
					route(
						"user/module/edit/:moduleId/setting",
						"routes/user/module/edit-setting.tsx",
					),
					route(
						"user/module/edit/:moduleId/access",
						"routes/user/module/edit-access.tsx",
					),
				]),
			]),
		]),
		route("course", "routes/course.tsx"),
		layout("layouts/course-layout.tsx", [
			layout("layouts/course-content-layout.tsx", [
				route("course/:id", "routes/course.$id.tsx"),
				layout("layouts/course-module-layout.tsx", [
					route("course/module/:id", "routes/course/module.$id.tsx"),
					route("course/module/:id/edit", "routes/course/module.$id.edit.tsx"),
					route(
						"course/module/:id/submissions",
						"routes/course/module.$id.submissions.tsx",
					),
				]),
				layout("layouts/course-section-layout.tsx", [
					route("course/section/:id", "routes/course/section.$id.tsx"),
					route("course/section/:id/edit", "routes/course/section-edit.tsx"),
				]),
			]),
			route("course/:id/section/new", "routes/course/section-new.tsx"),
			route("course/:id/settings", "routes/course.$id.settings.tsx"),
			layout("layouts/course-participants-layout.tsx", [
				route("course/:id/participants", "routes/course.$id.participants.tsx"),
				route(
					"course/:id/participants/profile",
					"routes/course.$id.participants.profile.tsx",
				),
				route("course/:id/groups", "routes/course.$id.groups.tsx"),
			]),
			layout("layouts/course-grades-layout.tsx", [
				route("course/:id/grades", "routes/course.$id.grades.tsx"),
			]),
			route("course/:id/modules", "routes/course.$id.modules.tsx"),
			route("course/:id/bin", "routes/course.$id.bin.tsx"),
			route("course/:id/backup", "routes/course.$id.backup.tsx"),
		]),
		layout("layouts/server-admin-layout.tsx", [
			route("admin/*", "routes/admin/index.tsx"),
			route("admin/users", "routes/admin/users.tsx"),
			route("admin/user/new", "routes/admin/new.tsx"),
			route("admin/courses", "routes/admin/courses.tsx"),
			route("admin/system", "routes/admin/system.tsx"),
			route("admin/test-email", "routes/admin/test-email.tsx"),
			route("admin/registration", "routes/admin/registration.tsx"),
			route("admin/course/new", "routes/admin/course-new.tsx"),
			route("admin/categories", "routes/admin/categories.tsx"),
			route("admin/category/new", "routes/admin/category-new.tsx"),
			route("admin/migrations", "routes/admin/migrations.tsx"),
			route("admin/dependencies", "routes/admin/dependencies.tsx"),
			route("admin/cron-jobs", "routes/admin/cron-jobs.tsx"),
			route("admin/maintenance", "routes/admin/maintenance.tsx"),
			route("admin/sitepolicies", "routes/admin/sitepolicies.tsx"),
			route("admin/media", "routes/admin/media.tsx"),
		]),
	]),
] as const satisfies RouteConfig;

export default routes;
