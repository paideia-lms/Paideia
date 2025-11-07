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
	/**
	 * sharp is only required when you use these upload collection features: index.ts:841-849
	 *
	 * imageSizes - automatic image resizing to multiple sizes overview.mdx:108
	 * formatOptions - image format conversion overview.mdx:106
	 * resizeOptions - image resizing configuration overview.mdx:111
	 * crop - cropping functionality overview.mdx:99
	 * focalPoint - focal point selection overview.mdx:105
	 */
	upload: {
		disableLocalStorage: true,
		// ! we don't use image size for now because we don't want the sharp dependency
		// imageSizes: [
		// 	{
		// 		name: "thumbnail",
		// 		width: 400,
		// 		height: 300,
		// 		position: "centre",
		// 	},
		// 	{
		// 		name: "card",
		// 		width: 768,
		// 		height: 1024,
		// 		position: "centre",
		// 	},
		// 	{
		// 		name: "tablet",
		// 		width: 1024,
		// 		height: undefined,
		// 		position: "centre",
		// 	},
		// ],
		// adminThumbnail: "thumbnail",
	},
} as const satisfies CollectionConfig;
