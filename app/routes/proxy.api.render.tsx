/**
 * 🎨 Proxy API - Section Render
 * Handles section render requests when accessed via App Proxy
 * Route: /proxy/api.render
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[ProxyApiRender] Request received");

  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId");
    const sectionId = url.searchParams.get("sectionId");

    // Get all other params to pass to the section (settings)
    const params = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (key !== "themeId" && key !== "sectionId") {
        params.append(key, value);
      }
    });

    if (!themeId || !sectionId) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Fetch from storefront using section rendering API
    const shopUrl = `https://${session.shop}`;
    const fetchUrl = `${shopUrl}/?section_id=${sectionId}&preview_theme_id=${themeId}&${params.toString()}`;

    const response = await fetch(fetchUrl);

    if (!response.ok) {
      return json({ error: "Failed to fetch section", details: response.statusText }, { status: response.status });
    }

    let html = await response.text();

    // Check for password page
    if (html.includes('id="password-login"') || html.includes('type="password"')) {
      return json({ error: "Store is password protected. Please disable password." }, { status: 403 });
    }

    // Inject base tag to fix relative links
    if (!html.includes("<base")) {
      html = html.replace("<head>", `<head><base href="${shopUrl}/">`);
    }

    return json({ html });

  } catch (error) {
    console.error("[ProxyApiRender] Error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
