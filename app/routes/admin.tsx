import { lazy, Suspense, useSyncExternalStore, } from "react";
import { isRouteErrorResponse, type LoaderFunctionArgs, redirect, useLoaderData, } from "react-router";
import { dbContextKey } from "server/db-context";
import { Route } from "./+types/admin";
import { useHydrated } from "remix-utils/use-hydrated";
import { Box, Text, Title } from "@mantine/core";
import { unauthorized, UnauthorizedResponse } from "~/utils/responses";





export const loader = async ({ context, request }: LoaderFunctionArgs) => {
    const { app } = context.get(dbContextKey);

    return {

    };
}


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

    return (
        <>admin</>
    );
}