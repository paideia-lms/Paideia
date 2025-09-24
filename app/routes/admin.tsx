import { lazy, Suspense, useSyncExternalStore } from "react";
import { isRouteErrorResponse, type LoaderFunctionArgs, useLoaderData } from "react-router";
import "bknd/dist/styles.css";
import { dbContextKey } from "server/db-context";
import type { App } from "bknd";
import { Route } from "./+types/admin";
import { Admin } from "bknd/ui"
import { useHydrated } from "remix-utils/use-hydrated";
import { Box, Text, Title } from "@mantine/core";
import { unauthorized, UnauthorizedResponse } from "~/utils/responses";



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


export const loader = async ({ context }: LoaderFunctionArgs) => {
    const { app } = context.get(dbContextKey);
    const api = await getApi(app);
    const user = api.getUser();
    if (!user || user.role !== "admin") {
        throw new UnauthorizedResponse("You need to be admin to access this page")
    }
    return {
        user: user,
    };
};


// error boundary
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    return (
        <Box p="md">
            {isRouteErrorResponse(error) ? (
                <>
                    <Title order={1} c="red">
                        {error.status} {error.statusText}
                    </Title>
                    <p>{typeof error.data === "string" ? error.data : JSON.stringify(error.data)}</p>
                </>
            ) : error instanceof Error ? (
                <div>
                    <h1>Error</h1>
                    <p>{error.message}</p>
                    <p>The stack trace is:</p>
                    <pre>{error.stack}</pre>
                </div>
            ) : (
                <h1>Unknown Error</h1>
            )}
        </Box>
    );
}
export default function AdminPage({ loaderData }: Route.ComponentProps) {
    const { user } = loaderData;

    const hydrated = useHydrated();

    if (!hydrated) {
        return <div>Loading...</div>;
    }

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Admin
                withProvider={{ user }}
                config={{ basepath: "/admin", logo_return_path: "/../" }}
            />
        </Suspense>
    );
}