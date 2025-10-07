import type { CollectionConfig } from "payload";

// Media collection for file uploads with S3 storage
export const Media = {
	slug: "media",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "alt",
			type: "text",
			label: "Alt Text",
		},
		{
			name: "caption",
			type: "textarea",
			label: "Caption",
		},
	],
	upload: {
		disableLocalStorage: true,
		imageSizes: [
			{
				name: "thumbnail",
				width: 400,
				height: 300,
				position: "centre",
			},
			{
				name: "card",
				width: 768,
				height: 1024,
				position: "centre",
			},
			{
				name: "tablet",
				width: 1024,
				height: undefined,
				position: "centre",
			},
		],
		adminThumbnail: "thumbnail",
	},
} as const satisfies CollectionConfig;
