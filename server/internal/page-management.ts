import type { Payload, PayloadRequest } from "payload";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	InvalidArgumentError,
	NonExistingPageError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { User } from "../payload-types";

export interface CreatePageArgs {
	payload: Payload;
	content?: string;
	userId: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdatePageArgs {
	payload: Payload;
	id: number;
	content?: string;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeletePageArgs {
	payload: Payload;
	id: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface GetPageByIdArgs {
	payload: Payload;
	id: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export const tryCreatePage = Result.wrap(
	async (args: CreatePageArgs) => {
		const {
			payload,
			content,
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const page = await payload
			.create({
				collection: "pages",
				data: {
					content: content || "",
					createdBy: userId,
				},
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZod(createdBy, z.object({ id: z.number() }));
				return {
					...r,
					createdBy,
				};
			});

		return page;
	},
	(error) => transformError(error) ?? new UnknownError("Failed to create page"),
);

export const tryUpdatePage = Result.wrap(
	async (args: UpdatePageArgs) => {
		const {
			payload,
			id,
			content,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!id) {
			throw new InvalidArgumentError("Page ID is required");
		}

		// Check if page exists
		const existingPage = await payload.findByID({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingPage) {
			throw new NonExistingPageError("Page not found");
		}

		const page = await payload
			.update({
				collection: "pages",
				id,
				data: {
					content,
				},
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZod(createdBy, z.object({ id: z.number() }));
				return {
					...r,
					createdBy,
				};
			});

		return page;
	},
	(error) => transformError(error) ?? new UnknownError("Failed to update page"),
);

export const tryDeletePage = Result.wrap(
	async (args: DeletePageArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("Page ID is required");
		}

		// Check if page exists
		const existingPage = await payload.findByID({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingPage) {
			throw new NonExistingPageError("Page not found");
		}

		await payload.delete({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		return { success: true };
	},
	(error) => transformError(error) ?? new UnknownError("Failed to delete page"),
);

export const tryGetPageById = Result.wrap(
	async (args: GetPageByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("Page ID is required");
		}

		const page = await payload.findByID({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!page) {
			throw new NonExistingPageError("Page not found");
		}

		return page;
	},
	(error) =>
		transformError(error) ?? new UnknownError("Failed to get page by ID"),
);
