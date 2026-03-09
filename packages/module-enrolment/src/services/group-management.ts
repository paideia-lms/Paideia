import { Result } from "typescript-result";
import { Groups } from "../collections/groups";
import { InvalidArgumentError, UnknownError } from "@paideia/shared";
import { transformError } from "../errors";
import { handleTransactionId } from "@paideia/shared";
import { type BaseInternalFunctionArgs, stripDepth } from "@paideia/shared";

export interface CreateGroupArgs extends BaseInternalFunctionArgs {
	name: string;
	course: number;
	parent?: number;
	description?: string;
	color?: string;
	maxMembers?: number;
	metadata?: Record<string, unknown>;
}

export interface UpdateGroupArgs extends BaseInternalFunctionArgs {
	groupId: number;
	name?: string;
	parent?: number;
	description?: string;
	color?: string;
	maxMembers?: number;
	metadata?: Record<string, unknown>;
}

export interface DeleteGroupArgs extends BaseInternalFunctionArgs {
	groupId: number;
}

export interface FindGroupByIdArgs extends BaseInternalFunctionArgs {
	groupId: number;
}

export interface FindGroupsByCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
	limit?: number;
}

export interface FindGroupByPathArgs extends BaseInternalFunctionArgs {
	courseId: number;
	path: string;
}

export interface FindChildGroupsArgs extends BaseInternalFunctionArgs {
	parentGroupId: number;
	limit?: number;
}

export interface FindRootGroupsArgs extends BaseInternalFunctionArgs {
	courseId: number;
	limit?: number;
}

export function tryCreateGroup(args: CreateGroupArgs) {
	return Result.try(
		async () => {
			const {
				payload, name, course, parent, description, color, maxMembers, metadata, req, overrideAccess = false,
			} = args;

			if (!name) {
				throw new InvalidArgumentError("Group name is required");
			}

			if (!course) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				if (parent) {
					const parentGroup = await payload
						.findByID({
							collection: Groups.slug,
							id: parent,
							req: txInfo.reqWithTransaction,
							overrideAccess: true,
							depth: 0,
						})
						.then(stripDepth<0, "findByID">());

					const parentCourseId = parentGroup?.course;

					if (parentCourseId !== course) {
						throw new InvalidArgumentError(
							"Parent group must belong to the same course"
						);
					}
				}

				const newGroup = await payload
					.create({
						collection: Groups.slug,
						data: {
							name,
							course,
							parent,
							description,
							color,
							maxMembers,
							metadata,
							path: "",
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "create">());

				return newGroup;
			});
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to create group", { cause: error })
	);
}

export function tryUpdateGroup(args: UpdateGroupArgs) {
	return Result.try(
		async () => {
			const {
				payload, groupId, name, parent, description, color, maxMembers, metadata, req, overrideAccess = false,
			} = args;

			if (!groupId) {
				throw new InvalidArgumentError("Group ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const existingGroup = await payload
					.findByID({
						collection: Groups.slug,
						id: groupId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
						depth: 1,
					})
					.then(stripDepth<0, "findByID">());

				if (parent !== undefined) {
					const parentGroup = await payload
						.findByID({
							collection: Groups.slug,
							id: parent,
							req: txInfo.reqWithTransaction,
							overrideAccess: true,
							depth: 0,
						})
						.then(stripDepth<0, "findByID">());

					if (existingGroup.course !== parentGroup.course) {
						throw new InvalidArgumentError(
							"Parent group must belong to the same course"
						);
					}

					if (parent === groupId) {
						throw new InvalidArgumentError("Group cannot be its own parent");
					}
				}

				const updatedGroup = await payload
					.update({
						collection: Groups.slug,
						id: groupId,
						data: {
							name: name,
							parent: parent,
							description: description,
							color: color,
							maxMembers: maxMembers,
							metadata: metadata,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				return updatedGroup;
			});
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to update group", { cause: error })
	);
}

export function tryDeleteGroup(args: DeleteGroupArgs) {
	return Result.try(
		async () => {
			const { payload, groupId, req, overrideAccess = false } = args;

			if (!groupId) {
				throw new InvalidArgumentError("Group ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const childGroups = await payload.find({
					collection: Groups.slug,
					where: {
						parent: { equals: groupId },
					},
					limit: 1,
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				if (childGroups.docs.length > 0) {
					throw new InvalidArgumentError(
						"Cannot delete group with child groups. Delete children first."
					);
				}

				const deletedGroup = await payload.delete({
					collection: Groups.slug,
					id: groupId,
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return deletedGroup;
			});
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to delete group", { cause: error })
	);
}

export function tryFindGroupById(args: FindGroupByIdArgs) {
	return Result.try(
		async () => {
			const { payload, groupId, req, overrideAccess = false } = args;

			if (!groupId) {
				throw new InvalidArgumentError("Group ID is required");
			}

			const group = await payload.findByID({
				collection: Groups.slug,
				id: groupId,
				req,
				overrideAccess,
			});

			return group;
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to find group by ID", { cause: error })
	);
}

export function tryFindGroupsByCourse(args: FindGroupsByCourseArgs) {
	return Result.try(
		async () => {
			const {
				payload, courseId, limit = 100, req, overrideAccess = false,
			} = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const groups = await payload.find({
				collection: Groups.slug,
				where: {
					course: { equals: courseId },
				},
				limit,
				sort: "path",
				req,
				overrideAccess,
			});

			return groups.docs;
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to find groups by course", { cause: error })
	);
}

export function tryFindGroupByPath(args: FindGroupByPathArgs) {
	return Result.try(
		async () => {
			const {
				payload, courseId, path, req, overrideAccess = false,
			} = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			if (!path) {
				throw new InvalidArgumentError("Group path is required");
			}

			const groups = await payload.find({
				collection: Groups.slug,
				where: {
					and: [
						{ course: { equals: courseId } },
						{ path: { equals: path } },
					],
				},
				limit: 1,
				req,
				overrideAccess,
			});

			return groups.docs.length > 0 ? groups.docs[0] : null;
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to find group by path", { cause: error })
	);
}

export function tryFindChildGroups(args: FindChildGroupsArgs) {
	return Result.try(
		async () => {
			const {
				payload, parentGroupId, limit = 100, req, overrideAccess = false,
			} = args;

			if (!parentGroupId) {
				throw new InvalidArgumentError("Parent group ID is required");
			}

			const groups = await payload.find({
				collection: Groups.slug,
				where: {
					parent: { equals: parentGroupId },
				},
				limit,
				sort: "name",
				req,
				overrideAccess,
			});

			return groups.docs;
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to find child groups", { cause: error })
	);
}

export function tryFindRootGroups(args: FindRootGroupsArgs) {
	return Result.try(
		async () => {
			const {
				payload, courseId, limit = 100, req, overrideAccess = false,
			} = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const groups = await payload.find({
				collection: Groups.slug,
				where: {
					and: [
						{ course: { equals: courseId } },
						{ parent: { exists: false } },
					],
				},
				limit,
				sort: "name",
				req,
				overrideAccess,
			});

			return groups.docs;
		},
		(error) => transformError(error) ??
			new UnknownError("Failed to find root groups", { cause: error })
	);
}
