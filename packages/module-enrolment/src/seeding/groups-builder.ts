import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "@paideia/shared";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateGroup } from "../services/group-management";
import type { GroupSeedData } from "./group-seed-schema";

export interface TrySeedGroupsArgs extends BaseInternalFunctionArgs {
	data: GroupSeedData;
	coursesBySlug: Map<string, { id: number }>;
}

export interface SeedGroupsResult {
	groups: any[];
	groupsByPath: Map<string, any>;
	getGroupByPath: (path: string) => any | undefined;
}

class GroupsSeedBuilder extends SeedBuilder<
	GroupSeedData["groups"][number],
	any
> {
	readonly entityName = "group";
	private coursesBySlug: Map<string, { id: number }>;

	constructor(coursesBySlug: Map<string, { id: number }>) {
		super();
		this.coursesBySlug = coursesBySlug;
	}

	protected async seedEntities(
		inputs: GroupSeedData["groups"][number][],
		context: SeedContext,
	): Promise<any[]> {
		const result: any[] = [];
		const groupsByPath = new Map<string, any>();

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

			const group = await tryCreateGroup({
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
			}).getOrThrow();

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
			const groupsByPath = new Map<string, any>();
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
