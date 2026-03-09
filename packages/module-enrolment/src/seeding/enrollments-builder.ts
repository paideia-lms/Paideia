import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "@paideia/shared";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateEnrollment } from "../services/enrollment-management";
import { tryFindGroupByPath } from "../services/group-management";
import type { EnrollmentSeedData } from "./enrollment-seed-schema";

export interface TrySeedEnrollmentsArgs extends BaseInternalFunctionArgs {
	data: EnrollmentSeedData;
	usersByEmail: Map<string, { id: number }>;
	coursesBySlug: Map<string, { id: number }>;
}

export interface SeedEnrollmentsResult {
	enrollments: any[];
	enrollmentsByKey: Map<string, any>;
	getEnrollmentByKey: (userEmail: string, courseSlug: string) => any | undefined;
}

class EnrollmentsSeedBuilder extends SeedBuilder<
	EnrollmentSeedData["enrollments"][number],
	any
> {
	readonly entityName = "enrollment";
	private usersByEmail: Map<string, { id: number }>;
	private coursesBySlug: Map<string, { id: number }>;

	constructor(
		usersByEmail: Map<string, { id: number }>,
		coursesBySlug: Map<string, { id: number }>,
	) {
		super();
		this.usersByEmail = usersByEmail;
		this.coursesBySlug = coursesBySlug;
	}

	protected async seedEntities(
		inputs: EnrollmentSeedData["enrollments"][number][],
		context: SeedContext,
	): Promise<any[]> {
		const result: any[] = [];

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

			const enrollment = await tryCreateEnrollment({
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
			}).getOrThrow();

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
			const enrollmentsByKey = new Map<string, any>();
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
