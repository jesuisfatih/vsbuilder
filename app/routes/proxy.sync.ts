/**
 * 🔄 App Proxy Sync Route
 * =======================
 * Syncs theme files from Shopify to local storage
 */
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { isThemeSavedLocally, saveThemeToLocal } from "../utils/theme.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId") || "";
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '').replace('gid://shopify/Theme/', '');
    const shopHandle = session.shop.replace(".myshopify.com", "");

    const isSynced = cleanThemeId ? isThemeSavedLocally(shopHandle, cleanThemeId) : false;

    return new Response(JSON.stringify({
      synced: isSynced,
      shopHandle,
      themeId: cleanThemeId
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[ProxySync] Loader error:", error);
    return new Response(JSON.stringify({ error: "Failed to check sync status" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.public.appProxy(request);

    if (!session || !admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId") || "";
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '').replace('gid://shopify/Theme/', '');
    const shopHandle = session.shop.replace(".myshopify.com", "");

    if (!cleanThemeId) {
      return new Response(JSON.stringify({ error: "Missing themeId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`[ProxySync] Syncing theme ${cleanThemeId} for ${shopHandle}`);

    const success = await saveThemeToLocal(admin, cleanThemeId, shopHandle);

    if (success) {
      return new Response(JSON.stringify({
        success: true,
        message: "Theme synced successfully",
        shopHandle,
        themeId: cleanThemeId
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to sync theme"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

  } catch (error) {
    console.error("[ProxySync] Action error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
