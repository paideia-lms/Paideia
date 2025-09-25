import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import elysiaLogo from "./assets/elysia_v.webp";
import reactRouterLogo from "./assets/rr_lockup_light.png";
import { dbContextKey } from "server/db-context";
import '@mantine/core/styles.css';
import { MantineProvider } from "@mantine/core";
import { ColorSchemeScript } from '@mantine/core';



export function loader({ request, context }: Route.LoaderArgs) {
  const payload = context.get(dbContextKey).payload;
  const elysia = context.get(dbContextKey).elysia;
  // ! we can get elysia from context!!!
  // console.log(payload, elysia);
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
            <Outlet />
          </main>
        </MantineProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
