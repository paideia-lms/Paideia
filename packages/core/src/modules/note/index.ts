import { Notes } from "./collections/notes";

import { Payload } from "payload";
import {
    CreateNoteArgs,
    tryCreateNote,
    tryUpdateNote,
    UpdateNoteArgs,
    FindNoteByIdArgs,
    tryFindNoteById,
    trySearchNotes,
    SearchNotesArgs,
    tryDeleteNote,
    DeleteNoteArgs,
    tryFindNotesByUser,
    FindNotesByUserArgs,
} from "./services/note-management";
import { UserModule } from "modules/user";
import {
    trySeedNotes,
    TrySeedNotesArgs,
} from "./seeding/notes-builder";
import { predefinedNoteSeedData } from "./seeding/predefined-note-seed-data";
import type { NoteSeedData as NoteSeedDataType } from "./seeding/note-seed-schema";
import { createNote, updateNote, findNoteById, searchNotes, deleteNote, findNotesByUser } from "./api/note-management";

export namespace NoteModule {
    export type NoteSeedData = NoteSeedDataType;
}

/**
 * Note Module
 * 
 * @upstream
 * - `user`: Required for the `createdBy` relationship in the Notes collection.
 * 
 * @downstream None. Notes are standalone entities that other modules can reference.
 * 
 * Provides note-taking functionality for users with full-text search capabilities.
 */
export class NoteModule {
    private readonly payload: Payload;
    public static readonly moduleName = "note" as const;
    public static readonly dependencies = ["user"] as const;
    public static readonly collections = [Notes];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = predefinedNoteSeedData;
    public static readonly queues = []
    public static readonly tasks = []
    public static readonly api = {
        createNote,
        updateNote,
        findNoteById,
        searchNotes,
        deleteNote,
        findNotesByUser,
    }

    constructor(payload: Payload) {
        this.payload = payload;
    }

    createNote(args: Omit<CreateNoteArgs, "payload">) {
        return tryCreateNote({
            payload: this.payload,
            ...args,
        })
    }

    updateNote(args: Omit<UpdateNoteArgs, "payload">) {
        return tryUpdateNote({
            payload: this.payload,
            ...args,
        })
    }

    findNoteById(args: Omit<FindNoteByIdArgs, "payload">) {
        return tryFindNoteById({
            payload: this.payload,
            ...args,
        })
    }

    searchNotes(args: Omit<SearchNotesArgs, "payload">) {
        return trySearchNotes({
            payload: this.payload,
            ...args,
        })
    }

    deleteNote(args: Omit<DeleteNoteArgs, "payload">) {
        return tryDeleteNote({
            payload: this.payload,
            ...args,
        })
    }

    findNotesByUser(args: Omit<FindNotesByUserArgs, "payload">) {
        return tryFindNotesByUser({
            payload: this.payload,
            ...args,
        });
    }

    async seedNotes(args: Omit<TrySeedNotesArgs, "payload">) {
        return trySeedNotes({
            payload: this.payload,
            ...args,
        });
    }
}