import { type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return new Response("Unauthorized: Invalid signature or session not found", { status: 401 });
    }

    // Return simple HTML to verify connection
    // We use application/liquid content type for Shopify Proxy to process it properly
    return new Response(`
      {% layout none %}
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>VSBuilder Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f6f6f7;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #202223;
          }
          .card {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 { color: #008060; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Proxy Active 🚀</h1>
          <p>Connected to <strong>${session.shop}</strong></p>
          <p>The editor is ready to separate from the admin panel.</p>
        </div>
      </body>
      </html>
    `, {
      headers: {
        "Content-Type": "application/liquid" // Important header
      }
    });

  } catch (error) {
    console.error("Proxy Loader Error:", error);
    return new Response(`Proxy Error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
};

// No default export - this is a Resource Route (API-only)
