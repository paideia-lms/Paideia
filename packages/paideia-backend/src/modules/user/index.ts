import { Payload } from "payload";
import * as internal from "./services/user-management"
import { Users } from "./collections/users"
import {
    trySeedMedia,
    TrySeedMediaArgs,
} from "./seeding/media-builder";
import { trySeedUsers, TrySeedUsersArgs } from "./seeding/users-builder";
import { predefinedMediaSeedData } from "./seeding/predefined-media-seed-data";
import { predefinedUserSeedData } from "./seeding/predefined-user-seed-data";
import type { MediaSeedData as MediaSeedDataType } from "./seeding/media-seed-schema";
import type { UserSeedData as UserSeedDataType } from "./seeding/user-seed-schema";
import { Media } from "server/collections";
import {
    findUserById,
    findUserByEmail,
    findAllUsers,
} from "./api/user-management";
import {
    getMediaById,
    getMediaByFilenames,
    getMediaByIds,
    getAllMedia,
    deleteMedia,
    getMediaByMimeType,
    findMediaByUser,
    renameMedia,
    getUserMediaStats,
    getSystemMediaStats,
    getOrphanedMedia,
    getAllOrphanedFilenames,
    findMediaUsages,
} from "./api/media-management";

export namespace UserModule {
    export type MediaSeedData = MediaSeedDataType;
    export type UserSeedData = UserSeedDataType;
}

/**
 * User Module - responsible for user management
 * 
 * this is the single point of export for the user module.
 */
export class UserModule {
    private readonly payload: Payload;
    public static readonly collections = [
        Users,
        Media
    ];
    public static readonly cli = {
    }
    public static readonly search = [Users.slug]
    public static readonly seedData = {
        users: predefinedUserSeedData,
        media: predefinedMediaSeedData,
    }
    public static readonly queues = []
    public static readonly tasks = []
    public static readonly api = {
        users: {
            findById: findUserById,
            findByEmail: findUserByEmail,
            findAll: findAllUsers,
        },
        media: {
            getById: getMediaById,
            getByFilenames: getMediaByFilenames,
            getByIds: getMediaByIds,
            getAll: getAllMedia,
            delete: deleteMedia,
            getByMimeType: getMediaByMimeType,
            findByUser: findMediaByUser,
            rename: renameMedia,
            getUserStats: getUserMediaStats,
            getSystemStats: getSystemMediaStats,
            getOrphaned: getOrphanedMedia,
            getAllOrphanedFilenames: getAllOrphanedFilenames,
            findUsages: findMediaUsages,
        },
    }

    constructor(payload: Payload) {
        this.payload = payload;
    }

    async createUser(args: Omit<internal.CreateUserArgs, "payload">) {
        return internal.tryCreateUser({
            payload: this.payload,
            ...args,
        });
    }

    async updateUser(args: Omit<internal.UpdateUserArgs, "payload">) {
        return internal.tryUpdateUser({
            payload: this.payload,
            ...args,
        });
    }

    async deleteUser(args: Omit<internal.DeleteUserArgs, "payload">) {
        return internal.tryDeleteUser({
            payload: this.payload,
            ...args,
        });
    }

    async findUserById(args: Omit<internal.FindUserByIdArgs, "payload">) {
        return internal.tryFindUserById({
            payload: this.payload,
            ...args,
        });
    }

    async findUserByEmail(args: Omit<internal.FindUserByEmailArgs, "payload">) {
        return internal.tryFindUserByEmail({
            payload: this.payload,
            ...args,
        });
    }

    async findAllUsers(args: Omit<internal.FindAllUsersArgs, "payload">) {
        return internal.tryFindAllUsers({
            payload: this.payload,
            ...args,
        });
    }

    async loginUser(args: Omit<internal.LoginArgs, "payload">) {
        return internal.tryLogin({
            payload: this.payload,
            ...args,
        });
    }

    async registerFirstUser(args: Omit<internal.RegisterFirstUserArgs, "payload">) {
        return internal.tryRegisterFirstUser({
            payload: this.payload,
            ...args,
        });
    }

    async registerUser(args: Omit<internal.RegisterUserArgs, "payload">) {
        return internal.tryRegisterUser({
            payload: this.payload,
            ...args,
        });
    }

    async handleImpersonation(args: Omit<internal.HandleImpersonationArgs, "payload">) {
        return internal.tryHandleImpersonation({
            payload: this.payload,
            ...args,
        });
    }

    async getUserCount(args: Omit<internal.GetUserCountArgs, "payload">) {
        return internal.tryGetUserCount({
            payload: this.payload,
            ...args,
        });
    }

    async generateApiKey(args: Omit<internal.GenerateApiKeyArgs, "payload">) {
        return internal.tryGenerateApiKey({
            payload: this.payload,
            ...args,
        });
    }

    async revokeApiKey(args: Omit<internal.RevokeApiKeyArgs, "payload">) {
        return internal.tryRevokeApiKey({
            payload: this.payload,
            ...args,
        });
    }

    async getApiKeyStatus(args: Omit<internal.GetApiKeyStatusArgs, "payload">) {
        return internal.tryGetApiKeyStatus({
            payload: this.payload,
            ...args,
        });
    }

    async seedUsers(args: Omit<TrySeedUsersArgs, "payload">) {
        return trySeedUsers({
            payload: this.payload,
            ...args,
        });
    }

    async seedMedia(args: Omit<TrySeedMediaArgs, "payload">) {
        return trySeedMedia({
            payload: this.payload,
            ...args,
        });
    }
}



