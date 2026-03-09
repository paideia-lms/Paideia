import type { CollectionConfig } from "payload";

// Groups collection - organize enrollments within courses
// Groups can be nested (parent-child relationships)
export const Groups = {
	slug: "groups",
	defaultSort: "path",
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			label: "Group Name",
		},
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
			label: "Course",
		},
		{
			name: "parent",
			type: "relationship",
			relationTo: "groups",
			label: "Parent Group",
		},
		{
			name: "path",
			type: "text",
			required: true,
			label: "Group Path",
			unique: true,
		},
		{
			name: "description",
			type: "textarea",
			label: "Description",
		},
		{
			name: "color",
			type: "text",
			label: "Color",
		},
		{
			name: "maxMembers",
			type: "number",
			label: "Maximum Members",
		},
		{
			name: "metadata",
			type: "json",
			label: "Metadata",
		},
		{
			name: "enrollments",
			type: "join",
			on: "groups",
			collection: "enrollments",
			label: "Enrollments",
		},
	],
	indexes: [
		{
			fields: ["course", "path"],
			unique: true,
		},
	],
	hooks: {
		beforeValidate: [
			async ({ data, operation, req }) => {
				if (
					operation === "create" ||
					(operation === "update" && data?.parent)
				) {
					if (data?.parent && typeof data.parent === "number") {
						const parentGroup = await req.payload.findByID({
							collection: "groups",
							id: data.parent,
							req,
						});

						if (parentGroup?.path) {
							data.path = `${parentGroup.path}/${data.name}`;
						}
					} else if (data && !data?.parent) {
						data.path = data.name;
					}
				}

				return data;
			},
		],
	},
} as const satisfies CollectionConfig;
