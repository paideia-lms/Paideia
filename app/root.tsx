import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import elysiaLogo from "./assets/elysia_v.webp";
import reactRouterLogo from "./assets/rr_lockup_light.png";
import { dbContextKey } from "server/global-context";
import '@mantine/core/styles.css';
import { Button, MantineProvider } from "@mantine/core";
import { ColorSchemeScript } from '@mantine/core';
import { useState } from "react";



export async function loader({ request, context }: Route.LoaderArgs) {
  const payload = context.get(dbContextKey).payload;
  const elysia = context.get(dbContextKey).elysia;
  const api = context.get(dbContextKey).api;
  // ! we can get elysia from context!!!
  // console.log(payload, elysia);
  const users = await api.some.get()

  return {
    users: users.data
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
        <Meta />
        <Links />
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider >
          <main>
            <pre>{JSON.stringify(loaderData, null, 2)}</pre>
            <Outlet />
          </main>
        </MantineProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
