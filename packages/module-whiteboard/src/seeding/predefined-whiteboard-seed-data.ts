import whiteboardData from "../fixture/whiteboard-data.json";
import type { WhiteboardSeedData } from "./whiteboard-seed-schema";

export const predefinedWhiteboardSeedData: WhiteboardSeedData = {
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
};
