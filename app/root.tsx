import type { LinksFunction } from "@remix-run/node";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    isRouteErrorResponse,
    useRouteError,
} from "@remix-run/react";
import tailwindStyles from "./styles/tailwind.css?url";

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css" },
  { rel: "stylesheet", href: tailwindStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // Check if we are on the proxy editor route
  // The path usually contains /proxy/editor or /apps/vsbuilder/editor depending on context
  const isProxyEditor = url.pathname.includes("/proxy/editor");

  return json({ isProxyEditor });
};

export default function App() {
  const data = useLoaderData<typeof loader>();
  const isProxyEditor = data?.isProxyEditor;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Hata olursa Beyaz Ekran yerine bunu gösterecek
export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = "Unknown error";
  let errorStack = "";

  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText} - ${error.data}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorStack = error.stack || "";
  }

  return (
    <html>
      <head>
        <title>Application Error</title>
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: `
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 2rem; background: #fef2f2; color: #991b1b; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          h1 { margin-top: 0; color: #b91c1c; }
          pre { background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow-x: auto; color: #374151; font-size: 0.9rem; }
        `}} />
      </head>
      <body>
        <div className="container">
          <h1>Application Error</h1>
          <p>The application encountered an error while rendering.</p>
          <p><strong>Error:</strong> {errorMessage}</p>
          {errorStack && (
            <details>
              <summary>View Stack Trace</summary>
              <pre>{errorStack}</pre>
            </details>
          )}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
