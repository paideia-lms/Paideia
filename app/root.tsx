import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import elysiaLogo from "./assets/elysia_v.webp";
import reactRouterLogo from "./assets/rr_lockup_light.png";
import { dbContextKey } from "server/db-context";

export function loader({ request, context }: Route.LoaderArgs) {
  const app = context.get(dbContextKey).app;

}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Elysia + React Router Example" },
    { name: "description", content: "Elysia + React Router example" },
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
      </head>
      <body>
        <main>
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
