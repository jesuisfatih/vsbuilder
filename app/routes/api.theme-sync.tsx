/**
 * 🔄 Theme Sync API
 * ==================
 * Temayı Shopify'dan indirir ve local disk'e kaydeder.
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { isThemeSavedLocally, saveThemeToLocal } from "../utils/theme.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const themeId = url.searchParams.get("themeId");

  if (!session || !themeId) {
    return json({ error: "Missing parameters" }, { status: 400 });
  }

  const shopHandle = session.shop.replace(".myshopify.com", "");
  const isSynced = isThemeSavedLocally(shopHandle, themeId);

  return json({
    synced: isSynced,
    shopHandle,
    themeId
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const themeId = formData.get("themeId") as string;

  if (!session || !themeId) {
    return json({ error: "Missing themeId" }, { status: 400 });
  }

  const shopHandle = session.shop.replace(".myshopify.com", "");

  console.log(`[Sync] Starting theme sync for ${shopHandle}/${themeId}`);

  try {
    const success = await saveThemeToLocal(admin, themeId, shopHandle);

    if (success) {
      return json({
        success: true,
        message: "Theme synced successfully",
        shopHandle,
        themeId
      });
    } else {
      return json({
        success: false,
        error: "Failed to sync theme"
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[Sync] Error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
