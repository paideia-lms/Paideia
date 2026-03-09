import { z } from "zod";
import whiteboardData from "../fixtures/whiteboard-data.json";

export const predefinedWhiteboardSeedData = {
	whiteboards: [
		{
			title: "Introduction to Mathematics",
			description: "A whiteboard for mathematics class",
			content: JSON.stringify(whiteboardData),
			userEmail: "instructor@example.com",
		},
		{
			title: "Physics Lab Notes",
			description: "Notes from the physics lab session",
			content: JSON.stringify(whiteboardData),
			userEmail: "instructor@example.com",
		},
	],
} satisfies z.infer<typeof import("./whiteboard-seed-schema").whiteboardSeedDataSchema>;
