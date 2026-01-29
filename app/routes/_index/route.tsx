import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { authenticate, login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const embedded = url.searchParams.get("embedded");
  const idToken = url.searchParams.get("id_token");

  // If this is an embedded request with id_token, try to authenticate
  if (shop && embedded === "1" && idToken) {
    try {
      // Try to authenticate - if successful, redirect to /app
      await authenticate.admin(request);
      return redirect("/app");
    } catch (error) {
      // If authentication fails, it will throw a redirect to OAuth
      throw error;
    }
  }

  // If just shop parameter (non-embedded), start login flow
  if (shop) {
    throw await login(request);
  }

  return json({ showForm: Boolean(login) });
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-900 text-white">
      <div className="absolute inset-0 bg-[url('https://cdn.shopify.com/s/files/1/0070/7032/files/gradient.png?v=1680000000')] opacity-20 bg-cover bg-center" />

      <div className="z-10 text-center space-y-8 max-w-2xl px-4">
        <h1 className="text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 animate-pulse">
          VSBuilder
        </h1>
        <p className="text-xl text-gray-400 font-light">
          The User-First Page Builder for Shopify 2.0. Native performance, premium design.
        </p>

        {showForm && (
          <Form method="post" action="/auth/login" className="flex flex-col gap-4 w-full max-w-md mx-auto mt-8">
            <label className="text-left text-sm font-medium text-gray-500">
              Store URL
            </label>
            <input
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              type="text"
              name="shop"
              placeholder="my-shop.myshopify.com"
            />
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-300"
            >
              Launch Builder
            </button>
          </Form>
        )}
      </div>

      <div className="absolute bottom-8 text-xs text-gray-600">
        Powered by Remix & Shopify Polaris
      </div>
    </div>
  );
}
