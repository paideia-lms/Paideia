import { createContext } from "react-router";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "../../app/utils/error";
import type { PaideiaContextArgs } from "./global-context";

export type Instructor = NonNullable<UserModuleContext>["instructors"][number];

export const userModuleContext = createContext<UserModuleContext | null>();

export { userModuleContextKey } from "./utils/context-keys";

interface TryGetUserModuleContextArgs extends PaideiaContextArgs {
	moduleId: number;
}

export function tryGetUserModuleContext(args: TryGetUserModuleContextArgs) {
	return Result.try(
		async () => {
			const { paideia, req, overrideAccess = false, moduleId } = args;
			const currentUser = req?.user;

			const [module, links, grants, instructors] = await Promise.all([
				paideia
					.tryGetActivityModuleById({
						id: moduleId,
						req,
						overrideAccess,
					})
					.getOrThrow(),
				paideia
					.tryFindLinksByActivityModule({
						activityModuleId: moduleId,
						req,
						overrideAccess,
					})
					.getOrThrow(),
				paideia
					.tryFindGrantsByActivityModule({
						activityModuleId: moduleId,
						req,
						overrideAccess,
					})
					.getOrThrow(),
				paideia
					.tryFindInstructorsForActivityModule({
						activityModuleId: moduleId,
						req,
						overrideAccess,
					})
					.getOrThrow(),
			]);

			// unique by course id
			const uniqueCourses = links
				.map((link) => link.course)
				.filter(
					(course, index, self) =>
						self.findIndex((c) => c.id === course.id) === index,
				)
				.map((course) => ({
					id: course.id,
					title: course.title,
					slug: course.slug,
					description: course.description,
					status: course.status,
					createdAt: course.createdAt,
					updatedAt: course.updatedAt,
				}));

			// Determine access type
			let accessType: "owned" | "granted" | "readonly" = "readonly";

			if (currentUser) {
				// Check if user is the owner
				if (module.owner.id === currentUser.id) {
					accessType = "owned";
				}
				// Check if user has been explicitly granted access
				else if (
					grants.some((grant) => grant.grantedTo.id === currentUser.id)
				) {
					accessType = "granted";
				}
				// Otherwise, they must be an instructor (readonly access)
				else {
					accessType = "readonly";
				}
			}

			return {
				module,
				accessType,
				linkedCourses: uniqueCourses,
				grants,
				instructors,
				links,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get user module context", { cause: error }),
	);
}

type UserModuleContext = Awaited<
	ReturnType<typeof tryGetUserModuleContext>
>["value"];
