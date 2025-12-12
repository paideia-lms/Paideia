import { z } from "zod";
export const urlSchema = z
	.url()
	.refine((url) => url.startsWith("http") || url.startsWith("https"), {
		message: "URL must start with http or https",
	})
	.array();
