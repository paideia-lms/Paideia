import type { Group } from "payload-types";
import type { Course } from "payload-types";
import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "../../../errors";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateGroup } from "../services/group-management";
import type { GroupSeedData } from "./group-seed-schema";

export interface TrySeedGroupsArgs extends BaseInternalFunctionArgs {
	data: GroupSeedData;
	coursesBySlug: Map<string, Course>;
}

export interface SeedGroupsResult {
	groups: Group[];
	groupsByPath: Map<string, Group>;
	getGroupByPath: (path: string) => Group | undefined;
}

class GroupsSeedBuilder extends SeedBuilder<
	GroupSeedData["groups"][number],
	Group
> {
	readonly entityName = "group";
	private coursesBySlug: Map<string, Course>;

	constructor(coursesBySlug: Map<string, Course>) {
		super();
		this.coursesBySlug = coursesBySlug;
	}

	protected async seedEntities(
		inputs: GroupSeedData["groups"][number][],
		context: SeedContext,
	): Promise<Group[]> {
		const result: Group[] = [];
		const groupsByPath = new Map<string, Group>();

		for (const input of inputs) {
			const course = this.coursesBySlug.get(input.courseSlug);
			if (!course) {
				throw new UnknownError(
					`Course not found for slug: ${input.courseSlug}. Seed courses first.`,
				);
			}

			let parentGroupId: number | undefined;
			if (input.parentGroupPath) {
				const parentGroup = groupsByPath.get(input.parentGroupPath);
				if (!parentGroup) {
					throw new UnknownError(
						`Parent group not found for path: ${input.parentGroupPath}. Seed groups in order.`,
					);
				}
				parentGroupId = parentGroup.id;
			}

			const group = (await tryCreateGroup({
				payload: context.payload,
				name: input.name,
				course: course.id,
				parent: parentGroupId,
				description: input.description,
				color: input.color,
				maxMembers: input.maxMembers,
				metadata: input.metadata,
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow()) as unknown as Group;

			result.push(group);

			if (group.path) {
				groupsByPath.set(group.path, group);
			}
		}

		return result;
	}
}

export function trySeedGroups(args: TrySeedGroupsArgs) {
	const builder = new GroupsSeedBuilder(args.coursesBySlug);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.groups },
		})
		.map((groups) => {
			const groupsByPath = new Map<string, Group>();
			for (const group of groups) {
				if (group.path) {
					groupsByPath.set(group.path, group);
				}
			}

			return {
				groups,
				groupsByPath,
				getGroupByPath: (path: string) => groupsByPath.get(path),
			};
		});
}
