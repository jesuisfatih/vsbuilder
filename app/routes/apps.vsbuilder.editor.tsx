/**
 * Frontend Route Alias
 */

export { default, headers } from "./proxy.editor";
import type { ClientLoaderFunctionArgs } from "@remix-run/react";

// Client Loader
export async function clientLoader({ request, params }: ClientLoaderFunctionArgs) {
  console.log('[apps.vsbuilder.editor] clientLoader running - V2 (Check global data)');

  if (typeof window !== 'undefined') {
    // 1. Check global failsafe data first
    const globalData = (window as any).__VSBUILDER_DATA;
    if (globalData) {
      console.log('[apps.vsbuilder.editor] Found global __VSBUILDER_DATA');
      return globalData;
    }

    const context = (window as any).__remixContext;

    // Helper to find data in various possible context structures
    const findData = (key: string) => {
      if (context?.loaderData?.[key]) return context.loaderData[key];
      if (context?.state?.loaderData?.[key]) return context.state.loaderData[key];
      return null;
    };

    const patchedData = findData("routes/apps.vsbuilder.editor");
    if (patchedData) {
      console.log('[apps.vsbuilder.editor] Found patched data');
      return patchedData;
    }

    const originalData = findData("routes/proxy.editor");
    if (originalData) {
      console.log('[apps.vsbuilder.editor] Found proxy.editor data, using it');
      return originalData;
    }
  }

  console.warn('[apps.vsbuilder.editor] No data found anywhere!');
  return null;
}

clientLoader.hydrate = true;
