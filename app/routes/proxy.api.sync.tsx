/**
 * 🔄 Proxy API - Theme Sync Handler
 * Handles theme sync requests when accessed via App Proxy
 * Route: /proxy/api.sync
 */
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { isThemeSavedLocally, saveThemeToLocal } from "../utils/theme.server";

// GET: Check if theme is synced
export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[ProxyApiSync] GET request received");

  try {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session || !admin) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId");

    if (!themeId) {
      return json({ error: "Missing themeId" }, { status: 400 });
    }

    // Check if theme is saved locally
    const shopHandle = session.shop.replace(".myshopify.com", "");
    const synced = isThemeSavedLocally(shopHandle, themeId);

    return json({ synced });
  } catch (error) {
    console.error("[ProxyApiSync] Error:", error);
    return json({ error: "Internal error", synced: false }, { status: 500 });
  }
};

// POST: Trigger theme sync
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("[ProxyApiSync] POST request received");

  try {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session || !admin) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const themeId = formData.get("themeId")?.toString();

    if (!themeId) {
      return json({ error: "Missing themeId", success: false }, { status: 400 });
    }

    console.log("[ProxyApiSync] Syncing theme:", themeId);
    const shopHandle = session.shop.replace(".myshopify.com", "");
    await saveThemeToLocal(admin, themeId, shopHandle);

    return json({ success: true });
  } catch (error) {
    console.error("[ProxyApiSync] Sync error:", error);
    return json({ error: "Sync failed", success: false }, { status: 500 });
  }
};
