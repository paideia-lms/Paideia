import { Notes } from "./collections/notes";

import { Payload } from "payload";
import { CreateNoteArgs, tryCreateNote, tryUpdateNote, UpdateNoteArgs, FindNoteByIdArgs, tryFindNoteById, trySearchNotes, SearchNotesArgs, tryDeleteNote, DeleteNoteArgs, tryFindNotesByUser, FindNotesByUserArgs } from "./services/note-management";


export namespace NoteModule {

}

export class NoteModule {
    private readonly payload: Payload;
    public static readonly collections = [
        Notes,
    ];
    public static readonly cli = {
    }
    public static readonly search = []
    public static readonly seedData = undefined;
    public static readonly queues = []
    public static readonly tasks = []

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
        })
    }
}