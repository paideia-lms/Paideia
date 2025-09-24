import { lazy, Suspense, useSyncExternalStore } from "react";
import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import "bknd/dist/styles.css";
import { dbContextKey } from "server/db-context";
import type { App } from "bknd";


export async function getApi(
    app: App,
    args?: { request: Request },
    opts?: { verify?: boolean },
) {
    if (opts?.verify) {
        const api = app.getApi({ headers: args?.request.headers });
        await api.verifyAuth();
        return api;
    }
    return app.getApi();
}

const Admin = lazy(() =>
    import("bknd/ui").then((mod) => ({ default: mod.Admin })),
);

export const loader = async ({ context }: LoaderFunctionArgs) => {
    const { app } = context.get(dbContextKey);
    const api = await getApi(app);
    return {
        user: api.getUser(),
    };
};

export default function AdminPage() {
    const { user } = useLoaderData<typeof loader>();
    // derived from https://github.com/sergiodxa/remix-utils
    const hydrated = useSyncExternalStore(
        // @ts-ignore
        () => { },
        () => true,
        () => false,
    );
    if (!hydrated) return null;

    return (
        <Suspense>
            <Admin
                withProvider={{ user }}
                config={{ basepath: "/admin", logo_return_path: "/../" }}
            />
        </Suspense>
    );
}