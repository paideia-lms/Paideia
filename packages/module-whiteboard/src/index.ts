import { Payload } from "payload";
import packageJson from "../package.json";
import { Whiteboards } from "./collections/whiteboards";
import {
	CreateWhiteboardArgs,
	tryCreateWhiteboard,
	tryUpdateWhiteboard,
	UpdateWhiteboardArgs,
	FindWhiteboardByIdArgs,
	tryFindWhiteboardById,
	trySearchWhiteboards,
	SearchWhiteboardsArgs,
	tryDeleteWhiteboard,
	DeleteWhiteboardArgs,
	tryFindWhiteboardsByUser,
	FindWhiteboardsByUserArgs,
} from "./services/whiteboard-management";
import {
	createWhiteboard,
	updateWhiteboard,
	findWhiteboardById,
	searchWhiteboards,
	deleteWhiteboard,
	findWhiteboardsByUser,
} from "./api/whiteboard-management";

/**
 * Whiteboard Module
 * 
 * @upstream
 * - `user`: Required for whiteboard ownership (createdBy field).
 * 
 * @downstream None. Whiteboards are standalone content entities.
 * 
 * Provides interactive whiteboard functionality for creating and managing
 * collaborative drawing and annotation content.
 */
export class WhiteboardModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(packageJson.dependencies);
	public static readonly collections = [Whiteboards];
	public static readonly cli = {};
	public static readonly search = [];
	public static readonly seedData = {};
	public static readonly queues = [];
	public static readonly tasks = [];
	public static readonly api = {
		createWhiteboard,
		updateWhiteboard,
		findWhiteboardById,
		searchWhiteboards,
		deleteWhiteboard,
		findWhiteboardsByUser,
	};

	constructor(payload: Payload) {
		this.payload = payload;
	}

	createWhiteboard(args: Omit<CreateWhiteboardArgs, "payload">) {
		return tryCreateWhiteboard({
			payload: this.payload,
			...args,
		});
	}

	updateWhiteboard(args: Omit<UpdateWhiteboardArgs, "payload">) {
		return tryUpdateWhiteboard({
			payload: this.payload,
			...args,
		});
	}

	findWhiteboardById(args: Omit<FindWhiteboardByIdArgs, "payload">) {
		return tryFindWhiteboardById({
			payload: this.payload,
			...args,
		});
	}

	searchWhiteboards(args: Omit<SearchWhiteboardsArgs, "payload">) {
		return trySearchWhiteboards({
			payload: this.payload,
			...args,
		});
	}

	deleteWhiteboard(args: Omit<DeleteWhiteboardArgs, "payload">) {
		return tryDeleteWhiteboard({
			payload: this.payload,
			...args,
		});
	}

	findWhiteboardsByUser(args: Omit<FindWhiteboardsByUserArgs, "payload">) {
		return tryFindWhiteboardsByUser({
			payload: this.payload,
			...args,
		});
	}
}
