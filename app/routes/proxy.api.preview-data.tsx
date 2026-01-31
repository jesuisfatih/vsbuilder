/**
 * 📦 Preview Data API
 * Provides mock data for preview rendering
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  buildMockContext,
  getMockBlogs,
  getMockCart,
  getMockCollections,
  getMockCustomer,
  getMockLinklists,
  getMockLocalization,
  getMockPages,
  getMockProducts,
  getMockRecommendations,
  getMockRequest,
  getMockRoutes,
  getMockSearch,
  getMockShop,
} from "../utils/mockData.server";

// GET /apps/vsbuilder/api/preview-data?type=...
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const dataType = url.searchParams.get("type") || "all";
    const shopDomain = url.searchParams.get("shop") || "my-store.myshopify.com";
    const count = parseInt(url.searchParams.get("count") || "8", 10);

    switch (dataType) {
      case "products":
        return json({
          success: true,
          data: getMockProducts(count),
        });

      case "collections":
        return json({
          success: true,
          data: getMockCollections(count),
        });

      case "cart":
        const cartItems = parseInt(url.searchParams.get("items") || "2", 10);
        return json({
          success: true,
          data: getMockCart(cartItems),
        });

      case "customer":
        const loggedIn = url.searchParams.get("loggedIn") === "true";
        return json({
          success: true,
          data: getMockCustomer(loggedIn),
        });

      case "shop":
        return json({
          success: true,
          data: getMockShop(shopDomain),
        });

      case "menus":
      case "linklists":
        return json({
          success: true,
          data: getMockLinklists(),
        });

      case "pages":
        return json({
          success: true,
          data: getMockPages(),
        });

      case "blogs":
        return json({
          success: true,
          data: getMockBlogs(),
        });

      case "search":
        const query = url.searchParams.get("q") || "";
        return json({
          success: true,
          data: getMockSearch(query),
        });

      case "recommendations":
        const productId = parseInt(url.searchParams.get("productId") || "0", 10);
        return json({
          success: true,
          data: getMockRecommendations(productId || undefined),
        });

      case "routes":
        return json({
          success: true,
          data: getMockRoutes(),
        });

      case "localization":
        return json({
          success: true,
          data: getMockLocalization(),
        });

      case "request":
        const path = url.searchParams.get("path") || "/";
        const designMode = url.searchParams.get("designMode") !== "false";
        return json({
          success: true,
          data: getMockRequest(path, designMode),
        });

      case "all":
      default:
        return json({
          success: true,
          data: buildMockContext({
            shopDomain,
            path: url.searchParams.get("path") || "/",
            template: url.searchParams.get("template") || "index",
            customerLoggedIn: url.searchParams.get("loggedIn") === "true",
            cartItemCount: parseInt(url.searchParams.get("cartItems") || "2", 10),
            designMode: true,
          }),
        });
    }
  } catch (error) {
    console.error("[API:preview-data] Error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to get preview data" },
      { status: 500 }
    );
  }
}
