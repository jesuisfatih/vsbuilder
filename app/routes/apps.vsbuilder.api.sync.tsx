/**
 * Alias Route for Proxy API Sync
 * Frontend URL: /apps/vsbuilder/api/sync
 */
export { action, loader } from "./proxy.api.sync";

// Client Loader - prevents Remix from attempting unauthorized server fetches
export async function clientLoader() {
  return null;
}
