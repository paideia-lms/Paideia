import type { Enrollment } from "payload-types";
import type { Course } from "payload-types";
import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "../../../errors";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateEnrollment } from "../services/enrollment-management";
import { tryFindGroupByPath } from "../services/group-management";
import type { EnrollmentSeedData } from "./enrollment-seed-schema";

export interface TrySeedEnrollmentsArgs extends BaseInternalFunctionArgs {
	data: EnrollmentSeedData;
	usersByEmail: Map<string, User>;
	coursesBySlug: Map<string, Course>;
}

export interface SeedEnrollmentsResult {
	enrollments: Enrollment[];
	enrollmentsByKey: Map<string, Enrollment>;
	getEnrollmentByKey: (userEmail: string, courseSlug: string) => Enrollment | undefined;
}

class EnrollmentsSeedBuilder extends SeedBuilder<
	EnrollmentSeedData["enrollments"][number],
	Enrollment
> {
	readonly entityName = "enrollment";
	private usersByEmail: Map<string, User>;
	private coursesBySlug: Map<string, Course>;

	constructor(
		usersByEmail: Map<string, User>,
		coursesBySlug: Map<string, Course>,
	) {
		super();
		this.usersByEmail = usersByEmail;
		this.coursesBySlug = coursesBySlug;
	}

	protected async seedEntities(
		inputs: EnrollmentSeedData["enrollments"][number][],
		context: SeedContext,
	): Promise<Enrollment[]> {
		const result: Enrollment[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.userEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.userEmail}. Seed users first.`,
				);
			}

			const course = this.coursesBySlug.get(input.courseSlug);
			if (!course) {
				throw new UnknownError(
					`Course not found for slug: ${input.courseSlug}. Seed courses first.`,
				);
			}

			let groupIds: number[] = [];
			if (input.groupPaths && input.groupPaths.length > 0) {
				for (const groupPath of input.groupPaths) {
					const groupResult = await tryFindGroupByPath({
						payload: context.payload,
						courseId: course.id,
						path: groupPath,
						req: context.req,
						overrideAccess: context.overrideAccess,
					});

					if (groupResult.ok && groupResult.value) {
						groupIds.push(groupResult.value.id);
					}
				}
			}

			const enrollment = (await tryCreateEnrollment({
				payload: context.payload,
				userId: user.id,
				course: course.id,
				role: input.role,
				status: input.status,
				enrolledAt: input.enrolledAt,
				completedAt: input.completedAt,
				groups: groupIds,
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow()) as unknown as Enrollment;

			result.push(enrollment);
		}

		return result;
	}
}

export function trySeedEnrollments(args: TrySeedEnrollmentsArgs) {
	const builder = new EnrollmentsSeedBuilder(
		args.usersByEmail,
		args.coursesBySlug,
	);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.enrollments },
		})
		.map((enrollments) => {
			const enrollmentsByKey = new Map<string, Enrollment>();
			for (const enrollment of enrollments) {
				const key = `${enrollment.user}-${enrollment.course}`;
				enrollmentsByKey.set(key, enrollment);
			}

			return {
				enrollments,
				enrollmentsByKey,
				getEnrollmentByKey: (userEmail: string, courseSlug: string) => {
					const user = args.usersByEmail.get(userEmail);
					const course = args.coursesBySlug.get(courseSlug);
					if (!user || !course) return undefined;
					return enrollmentsByKey.get(`${user.id}-${course.id}`);
				},
			};
		});
}
