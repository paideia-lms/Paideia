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
			// Optional - if null, this is a root-level group
		},
		{
			name: "path",
			type: "text",
			required: true,
			label: "Group Path",
			unique: true,
			// e.g., "art", "art/group-1", "econ/group-2/subgroup-a"
			// This is auto-generated based on parent hierarchy
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
			// Optional color for UI display (hex code)
		},
		{
			name: "maxMembers",
			type: "number",
			label: "Maximum Members",
			// Optional limit on number of enrollments in this group
		},
		{
			name: "isActive",
			type: "checkbox",
			defaultValue: true,
			label: "Is Active",
		},
		{
			name: "metadata",
			type: "json",
			label: "Metadata",
			// Flexible field for additional group properties
		},
		{
			name: "enrollments",
			type: "join",
			on: "groups",
			collection: "enrollments",
			label: "Enrollments",
		},
	],
	// Ensure unique course + path combinations
	indexes: [
		{
			fields: ["course", "path"],
			unique: true,
		},
	],
	hooks: {
		beforeValidate: [
			async ({ data, operation, req }) => {
				// Auto-generate path based on parent hierarchy
				if (
					operation === "create" ||
					(operation === "update" && data?.parent)
				) {
					if (data?.parent && typeof data.parent === "number") {
						// Fetch parent group to build path
						const parentGroup = await req.payload.findByID({
							collection: "groups",
							id: data.parent,
						});

						if (parentGroup?.path) {
							data.path = `${parentGroup.path}/${data.name}`;
						}
					} else if (data && !data?.parent) {
						// Root level group - path is just the name
						data.path = data.name;
					}
				}

				return data;
			},
		],
	},
} as const satisfies CollectionConfig;
