import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import elysiaLogo from "./assets/elysia_v.webp";
import reactRouterLogo from "./assets/rr_lockup_light.png";
import { dbContextKey } from "server/db-context";

export function loader({ request, context }: Route.LoaderArgs) {
  // console.log(context.get(dbContext))
  console.log(request)
  console.log(context)
  try {
    return context.get(dbContextKey)
  } catch (error) {
    console.log(error)
  }
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
        <main className="mx-auto max-w-screen-md mt-10 space-y-6">
          <div className="flex items-center gap-2">
            <img src={elysiaLogo} alt="Elysia" className="w-48" />
            <span className="text-2xl font-medium text-gray-600">+</span>
            <img src={reactRouterLogo} alt="React Router" className="h-12" />
          </div>
          {loaderData?.text ?? "No data"}


          <Outlet />
        </main>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
