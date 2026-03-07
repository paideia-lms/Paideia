import { devConstants } from "../../../utils/constants";
import type { GroupSeedData } from "./group-seed-schema";

export const predefinedGroupSeedData: GroupSeedData = {
	groups: [
		{
			name: "Section A",
			courseSlug: "cs-101-fa-2025",
			description: "Primary section for CS 101",
			color: "#FF5733",
		},
		{
			name: "Section B",
			courseSlug: "cs-101-fa-2025",
			description: "Secondary section for CS 101",
			color: "#33FF57",
		},
		{
			name: "Subsection A1",
			courseSlug: "cs-101-fa-2025",
			parentGroupPath: "Section A",
			description: "Subsection within Section A",
			color: "#3357FF",
		},
		{
			name: "Math Section",
			courseSlug: "math-201-fa-2025",
			description: "Primary section for Math 201",
			color: "#FF33F5",
		},
	],
};
