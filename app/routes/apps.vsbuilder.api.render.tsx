/**
 * Alias Route for Proxy API Render
 * Frontend URL: /apps/vsbuilder/api/render
 */
export { loader } from "./proxy.api.render";

// Client Loader - prevents Remix from attempting unauthorized server fetches
export async function clientLoader() {
  return null;
}
