import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import elysiaLogo from "./assets/elysia_v.webp";
import reactRouterLogo from "./assets/rr_lockup_light.png";
import { dbContextKey } from "server/contexts/global-context";
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { Notifications } from '@mantine/notifications';
import { Button, MantineProvider } from "@mantine/core";
import { ColorSchemeScript } from '@mantine/core';
import { useState } from "react";
import { getUserCount } from "server/internal/check-first-user";
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'




export async function loader({ request, context }: Route.LoaderArgs) {
  const { payload, requestInfo } = context.get(dbContextKey);
  // ! we can get elysia from context!!!
  // console.log(payload, elysia);
  const users = await getUserCount(payload)

  // Check if we need to redirect to first-user creation
  const url = new URL(request.url);
  const currentPath = url.pathname;

  // Skip redirect check for essential routes
  if (currentPath === '/first-user' || currentPath === '/login' || currentPath.startsWith('/api/')) {
    return {
      users: users
    };
  }

  // Check if database has any users
  const userCount = await payload.find({
    collection: "users",
    limit: 1,
  });

  // If no users exist, redirect to first-user creation
  if (userCount.docs.length === 0) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/first-user" },
    });
  }

  const timestamp = new Date().toISOString();

  return {
    users: users,
    domainUrl: requestInfo.domainUrl,
    timestamp: timestamp
  }
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Paideia LMS" },
    { name: "description", content: "Paideia LMS" },
  ];
};

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* ! this will force the browser to reload the favicon, see https://stackoverflow.com/questions/2208933/how-do-i-force-a-favicon-refresh */}
        <link rel="icon" href={`/favicon.ico?timestamp=${loaderData.timestamp}`} />
        <Meta />
        <Links />
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider >
          <NuqsAdapter>
            <Outlet />
            <Notifications />
          </NuqsAdapter>
        </MantineProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
