import { flatRoutes } from "@remix-run/fs-routes";
import { type RouteConfig, route } from "@remix-run/route-config";

export default async function routes(): Promise<RouteConfig> {
  const fsRoutes = await flatRoutes();

  return [
    // Custom route to match browser URL (after base prefix is applied)
    // Browser sees: /apps/vsbuilder/editor
    // But with base: /apps/vsbuilder/, the path becomes just /editor
    route("editor", "routes/proxy.editor.tsx"),

    // Also add catch-all for other paths under apps/vsbuilder
    route("*", "routes/proxy.$.tsx"),

    // Include all file-based routes
    ...fsRoutes,
  ];
}
