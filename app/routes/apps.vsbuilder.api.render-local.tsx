/**
 * Alias Route for Proxy API Render Local
 * Frontend URL: /apps/vsbuilder/api/render-local
 *
 * This route is used as an iframe src, not for Remix data loading.
 * The clientLoader prevents Remix from attempting server fetches.
 */
export { loader } from "./proxy.api.render-local";

// Client Loader - prevents Remix from fetching data (this is an iframe src route)
export async function clientLoader() {
  // render-local is loaded as iframe src directly, not via Remix data loading
  return null;
}
