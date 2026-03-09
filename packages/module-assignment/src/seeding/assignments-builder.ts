import type { Assignment } from "../payload-types";
import type { User, Course, CourseSection } from "../payload-types";
import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "@paideia/shared";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateAssignment } from "../services/assignment-management";
import type { AssignmentSeedData } from "./assignment-seed-schema";

export interface TrySeedAssignmentsArgs extends BaseInternalFunctionArgs {
	data: AssignmentSeedData;
	usersByEmail: Map<string, User>;
	coursesBySlug: Map<string, Course>;
	sectionsByTitle: Map<string, CourseSection>;
}

export interface SeedAssignmentsResult {
	assignments: Assignment[];
}

class AssignmentsSeedBuilder extends SeedBuilder<
	AssignmentSeedData["assignments"][number],
	Assignment
> {
	readonly entityName = "assignment";
	private usersByEmail: Map<string, User>;
	private coursesBySlug: Map<string, Course>;
	private sectionsByTitle: Map<string, CourseSection>;

	constructor(
		usersByEmail: Map<string, User>,
		coursesBySlug: Map<string, Course>,
		sectionsByTitle: Map<string, CourseSection>,
	) {
		super();
		this.usersByEmail = usersByEmail;
		this.coursesBySlug = coursesBySlug;
		this.sectionsByTitle = sectionsByTitle;
	}

	protected async seedEntities(
		inputs: AssignmentSeedData["assignments"][number][],
		context: SeedContext,
	): Promise<Assignment[]> {
		const result: Assignment[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.createdByEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.createdByEmail}. Seed users first.`,
				);
			}

			const course = this.coursesBySlug.get(input.courseSlug);
			if (!course) {
				throw new UnknownError(
					`Course not found for slug: ${input.courseSlug}. Seed courses first.`,
				);
			}

			const section = this.sectionsByTitle.get(input.sectionTitle);
			if (!section) {
				throw new UnknownError(
					`Section not found for title: ${input.sectionTitle}. Seed sections first.`,
				);
			}

			const assignment = await tryCreateAssignment({
				payload: context.payload,
				data: {
					title: input.title,
					description: input.description,
					instructions: input.instructions,
					courseId: course.id,
					sectionId: section.id,
					dueDate: input.dueDate,
					maxAttempts: input.maxAttempts,
					maxGrade: input.maxGrade,
					requireTextSubmission: input.requireTextSubmission,
					requireFileSubmission: input.requireFileSubmission,
					createdBy: user.id,
				},
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow();

			result.push(assignment);
		}

		return result;
	}
}

export function trySeedAssignments(args: TrySeedAssignmentsArgs) {
	const builder = new AssignmentsSeedBuilder(
		args.usersByEmail,
		args.coursesBySlug,
		args.sectionsByTitle,
	);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.assignments },
		})
		.map((assignments) => ({ assignments }));
}
