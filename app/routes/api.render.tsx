import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
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

  if (!session || !themeId || !sectionId) {
    return json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    // Fetch directly from the storefront using the section rendering API
    // https://shopify.dev/docs/api/section-rendering
    const shopUrl = `https://${session.shop}`;
    // We utilize the storefront preview mechanism via the authenticated session or simple fetch
    // Since we are in the admin, we might not have a storefront access token easily available
    // BUT, we can fetch the preview URL because we are authenticated admins.

    // Construct the storefront section URL
    // Format: https://{shop}/?section_id={section_id}&preview_theme_id={theme_id}
    const fetchUrl = `${shopUrl}/?section_id=${sectionId}&preview_theme_id=${themeId}&${params.toString()}`;

    // We need to fetch this content.
    // Note: Fetching storefront content from the server-side might require handling redirects or cookies if password protected.
    // However, for section rendering API with preview_theme_id, it usually works if the store is open or we use a clever trick.

    // Let's try a direct fetch first. The Admin usually can't fetch Storefront directly if it's password protected without a password.
    // OPTION 2 (Better): Return the URL to the frontend and let the frontend fetch it?
    // No, frontend iframe failed due to X-Frame-Options. But fetch() from frontend usually works if CORS allows.
    // Storefront API usually allows CORS.

    // Let's implement a server-side proxy to be safe.
    const response = await fetch(fetchUrl);

    if (!response.ok) {
       return json({ error: "Failed to fetch section", details: response.statusText }, { status: response.status });
    }

    let html = await response.text();

    // Check for password page
    if (html.includes('id="password-login"') || html.includes('type="password"')) {
        return json({ error: "Store is password protected. Please disable password." }, { status: 403 });
    }

    // Inject base tag to fix relative links (CSS, JS, Images)
    if (!html.includes("<base")) {
      html = html.replace("<head>", `<head><base href="${shopUrl}/">`);
    }

    // Return HTML wrapped in JSON for easier consumption by useFetcher
    return json({ html });

  } catch (error) {
    console.error("Section render error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
