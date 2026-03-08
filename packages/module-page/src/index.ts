import { Payload } from "payload";
import packageJson from "../package.json";
import { Pages } from "./collections/pages";
import {
	CreatePageArgs,
	tryCreatePage,
	tryUpdatePage,
	UpdatePageArgs,
	FindPageByIdArgs,
	tryFindPageById,
	trySearchPages,
	SearchPagesArgs,
	tryDeletePage,
	DeletePageArgs,
	tryFindPagesByUser,
	FindPagesByUserArgs,
} from "./services/page-management";
import {
	createPage,
	updatePage,
	findPageById,
	searchPages,
	deletePage,
	findPagesByUser,
} from "./api/page-management";

/**
 * Pages Module
 * 
 * @upstream
 * - `user`: Required for page ownership (createdBy/updatedBy fields).
 * 
 * @downstream None. Pages are standalone content entities.
 * 
 * Provides page management functionality for creating and managing static content pages.
 * Similar to the note module but designed for different content use cases.
 */
export class PagesModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(packageJson.dependencies);
	public static readonly collections = [Pages];
	public static readonly cli = {};
	public static readonly search = [];
	public static readonly seedData = {};
	public static readonly queues = [];
	public static readonly tasks = [];
	public static readonly api = {
		createPage,
		updatePage,
		findPageById,
		searchPages,
		deletePage,
		findPagesByUser,
	};

	constructor(payload: Payload) {
		this.payload = payload;
	}

	createPage(args: Omit<CreatePageArgs, "payload">) {
		return tryCreatePage({
			payload: this.payload,
			...args,
		});
	}

	updatePage(args: Omit<UpdatePageArgs, "payload">) {
		return tryUpdatePage({
			payload: this.payload,
			...args,
		});
	}

	findPageById(args: Omit<FindPageByIdArgs, "payload">) {
		return tryFindPageById({
			payload: this.payload,
			...args,
		});
	}

	searchPages(args: Omit<SearchPagesArgs, "payload">) {
		return trySearchPages({
			payload: this.payload,
			...args,
		});
	}

	deletePage(args: Omit<DeletePageArgs, "payload">) {
		return tryDeletePage({
			payload: this.payload,
			...args,
		});
	}

	findPagesByUser(args: Omit<FindPagesByUserArgs, "payload">) {
		return tryFindPagesByUser({
			payload: this.payload,
			...args,
		});
	}
}