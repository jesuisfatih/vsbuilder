/**
 * Alias Route for Proxy API Render Local
 * Frontend URL: /apps/vsbuilder/api/render-local
 *
 * This route is used for iframe preview content.
 * The clientLoader fetches data via Shopify Proxy to get proper authentication.
 */

// Re-export loader for server-side rendering if accessed directly
export { loader } from "./proxy.api.render-local";

// Client Loader - fetches preview HTML via the Shopify Proxy path
export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const themeId = url.searchParams.get('themeId');
  const template = url.searchParams.get('template') || 'index';

  if (!themeId) {
    return { error: 'Missing themeId', html: '' };
  }

  try {
    // Fetch from the Shopify Proxy endpoint (goes through Shopify -> Backend)
    const response = await fetch(`/apps/vsbuilder/api/render-local?themeId=${themeId}&template=${template}`);

    if (!response.ok) {
      const errorText = await response.text();
      return { error: errorText, html: '' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[clientLoader] render-local error:', error);
    return { error: 'Failed to fetch preview', html: '' };
  }
}
