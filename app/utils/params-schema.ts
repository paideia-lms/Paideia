import { z } from "zod";

export const paramsSchema = {
	// filenameOrId can be a number or a string, we check if it is a number first and then check if it is a string
	filenameOrId: z.coerce.number().or(z.string()),
	id: z.coerce.number(),
	mediaId: z.coerce.number(),
	noteId: z.coerce.number(),
	moduleId: z.coerce.number(),
	courseId: z.coerce.number(),
	moduleLinkId: z.coerce.number(),
	sectionId: z.coerce.number(),
};

export type ParamsType = {
	[key in keyof typeof paramsSchema]: z.infer<(typeof paramsSchema)[key]>;
};
