/**
 * Alias Route for Proxy API Sync
 * Frontend URL: /apps/vsbuilder/api/sync
 */
export { action, loader } from "./proxy.api.sync";

// Client Loader - prevents Remix from attempting unauthorized server fetches
export async function clientLoader() {
  return null;
}

// Client Action - handles POST requests without Remix's internal routing
// This prevents 403 errors from missing Shopify signature
export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const themeId = formData.get('themeId');

  // Make a direct fetch to the Shopify Proxy endpoint
  const response = await fetch(`/apps/vsbuilder/api/sync`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return { success: false, error: 'Sync failed' };
  }

  return response.json();
}
