/**
 * Alias Route for Proxy API Render
 * Frontend URL: /apps/vsbuilder/api/render
 *
 * This route handles section rendering requests.
 * The clientLoader fetches data via Shopify Proxy.
 */

// Re-export loader for server-side rendering
export { loader } from "./proxy.api.render";

// Client Loader - fetches section HTML via Shopify Proxy
export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const params = url.searchParams.toString();

  try {
    // Fetch via Shopify Proxy
    const response = await fetch(`/apps/vsbuilder/api/render?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      return { error: errorText, html: '' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[clientLoader] render error:', error);
    return { error: 'Failed to fetch section', html: '' };
  }
}
