import type { CollectionConfig } from "payload";

// Activity Module Grants collection - tracks access grants to activity modules
export const ActivityModuleGrants = {
	slug: "activity-module-grants",
	defaultSort: "-grantedAt",
	fields: [
		{
			name: "activityModule",
			type: "relationship",
			relationTo: "activity-modules",
			required: true,
			label: "Activity Module",
		},
		{
			name: "grantedTo",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Granted To",
		},
		{
			name: "grantedBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Granted By",
		},
		{
			name: "grantedAt",
			type: "date",
			required: true,
			label: "Granted At",
			admin: {
				readOnly: true,
			},
		},
	],
	indexes: [
		{
			fields: ["activityModule", "grantedTo"],
			unique: true,
		},
		{
			fields: ["activityModule"],
		},
		{
			fields: ["grantedTo"],
		},
	],
} as const satisfies CollectionConfig;
