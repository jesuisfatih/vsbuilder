import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars2Icon,
  ChevronDownIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  PlusIcon,
  RectangleGroupIcon,
  Square3Stack3DIcon
} from "@heroicons/react/24/outline";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { authenticate } from "../shopify.server";
import { useEditorStore } from "../store/useEditorStore";
import { getActiveThemeId, getThemeAsset } from "../utils/theme.server";

/**
 * LOADER
 * Million Dollar Engine: Fetches the ACTUAL JSON structure from Shopify.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    // Check if admin and rest resources are available
    if (!admin?.rest?.resources) {
      console.error("[Editor] Admin REST resources not available");
      return json({
        shop: session?.shop || "demo-shop",
        themeId: null,
        initialData: {
          template: { sections: {}, order: [] },
          header: { sections: {}, order: [] },
          footer: { sections: {}, order: [] }
        },
        error: "Session not fully initialized. Please refresh the page."
      });
    }

    const themeId = await getActiveThemeId(admin);
    if (!themeId) {
      return json({
        shop: session.shop,
        themeId: null,
        initialData: {
          template: { sections: {}, order: [] },
          header: { sections: {}, order: [] },
          footer: { sections: {}, order: [] }
        },
        error: "No active theme found"
      });
    }

    // Get current store state from real theme files
    const [indexTemplate, headerGroup, footerGroup] = await Promise.all([
      getThemeAsset(admin, themeId.toString(), "templates/index.json"),
      getThemeAsset(admin, themeId.toString(), "config/header-group.json").catch(() => null),
      getThemeAsset(admin, themeId.toString(), "config/footer-group.json").catch(() => null),
    ]);

    return json({
      shop: session.shop,
      themeId,
      initialData: {
        template: indexTemplate || { sections: {}, order: [] },
        header: headerGroup || { sections: {}, order: [] },
        footer: footerGroup || { sections: {}, order: [] }
      }
    });
  } catch (error) {
    console.error("[Editor] Loader error:", error);
    return json({
      shop: "demo-shop",
      themeId: null,
      initialData: {
        template: { sections: {}, order: [] },
        header: { sections: {}, order: [] },
        footer: { sections: {}, order: [] }
      },
      error: "Failed to load editor. Please try again."
    });
  }
};

/**
 * TREE NODE COMPONENT
 */
const SectionNode = ({ id, section, isActive, onClick, depth = 0 }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 12 + 16}px`,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={clsx(
        "group flex items-center justify-between py-2.5 pr-3 my-0.5 rounded-lg cursor-default select-none border transition-all duration-200",
        isActive
          ? "bg-[#DAEFFF] border-[#AED6F1] text-[#0060A9] shadow-sm"
          : "bg-white border-transparent hover:bg-[#F3F4F6] text-[#202223]",
        isDragging && "opacity-40 scale-95"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div {...attributes} {...listeners} className="p-1 hover:bg-black/5 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <Bars2Icon className="w-4 h-4 text-[#8C9196]" />
        </div>

        <div className="flex items-center gap-2 truncate text-[13px] font-medium">
          {depth === 0 ? (
            <RectangleGroupIcon className={clsx("w-4 h-4 shrink-0", isActive ? "text-[#0060A9]" : "text-[#5C5F62]")} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mx-1" />
          )}
          <span className="truncate">{section?.type?.replace("-", " ") || "New Section"}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
         <button className="p-1.5 hover:bg-white rounded text-[#5C5F62]">
           <EyeIcon className="w-4 h-4" />
         </button>
      </div>
    </motion.div>
  );
};

/**
 * DYNAMIC PROPERTY INSPECTOR
 * The "Brain" that renders Shopify's Schema fields.
 */
const Inspector = ({ id, section }: any) => {
  if (!section) return (
    <div className="flex flex-col items-center justify-center h-full text-center p-12 space-y-4">
      <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center animate-pulse">
        <Square3Stack3DIcon className="w-10 h-10 text-gray-200" />
      </div>
      <p className="text-sm font-medium text-gray-400">Select an element to edit</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="h-14 flex items-center justify-between px-6 border-b border-gray-100 shrink-0">
        <h3 className="text-[14px] font-bold text-gray-900 capitalize italic">{section.type.replace("-", " ")}</h3>
        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><EllipsisHorizontalIcon className="w-5 h-5" /></button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
        {/* Dynamic Settings Renderer */}
        {Object.entries(section.settings || {}).map(([key, value]) => (
          <div key={key} className="space-y-3">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.05em]">{key.replace(/_/g, " ")}</label>
               <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 uppercase">{typeof value}</span>
            </div>

            {typeof value === 'boolean' ? (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative inline-flex items-center">
                  <input type="checkbox" className="sr-only peer" defaultChecked={value} />
                  <div className="w-10 h-6 bg-gray-100 rounded-full peer peer-checked:bg-[#008060] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner ring-1 ring-gray-200"></div>
                </div>
                <span className="text-sm font-medium text-gray-600">Enabled</span>
              </label>
            ) : typeof value === 'number' ? (
              <div className="space-y-4">
                 <input type="range" className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#2c6ecb]" defaultValue={value} />
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>0</span><span>{value}</span><span>100</span></div>
              </div>
            ) : (
              <input
                type="text"
                defaultValue={value as string}
                className="w-full h-10 px-4 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2383DA]/20 focus:border-[#2383DA] transition-all shadow-sm"
              />
            )}
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-gray-50 bg-[#F9FAFB] flex flex-col gap-3">
        <button className="w-full py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 shadow-sm">
           Remove Section
        </button>
      </div>
    </div>
  );
};

export default function Editor() {
  const { initialData, shop } = useLoaderData<typeof loader>();
  const shopifyBridge = useAppBridge();
  const store = useEditorStore();

  // Enter fullscreen mode when editor mounts
  useEffect(() => {
    // Shopify App Bridge Fullscreen API
    // This makes the app take over the entire screen like Theme Customizer
    if (shopifyBridge) {
      try {
        // @ts-ignore - Fullscreen API
        shopifyBridge.dispatch({
          type: 'APP::FULLSCREEN::OPEN',
        });
      } catch (e) {
        console.log('[Editor] Fullscreen dispatch error:', e);
      }
    }

    // Cleanup: exit fullscreen when leaving the editor
    return () => {
      if (shopifyBridge) {
        try {
          // @ts-ignore
          shopifyBridge.dispatch({
            type: 'APP::FULLSCREEN::CLOSE',
          });
        } catch (e) {
          console.log('[Editor] Fullscreen close error:', e);
        }
      }
    };
  }, [shopifyBridge]);

  // Initialize store with theme data
  useEffect(() => {
    store.setTemplate(initialData.template);
    store.setHeaderGroup(initialData.header);
    store.setFooterGroup(initialData.footer);
  }, []);

  const activeSection = useMemo(() => {
    if (!store.selectedId) return null;
    return store.template.sections[store.selectedId] ||
           store.headerGroup.sections[store.selectedId] ||
           store.footerGroup.sections[store.selectedId];
  }, [store.selectedId, store.template, store.headerGroup, store.footerGroup]);

  return (
    <div className="h-screen w-full flex flex-col bg-[#F3F4F6] text-[#202223] overflow-hidden font-sans select-none">

      {/* MEGA TOP BAR */}
      <nav className="h-[56px] bg-white border-b border-gray-200 flex items-center justify-between px-6 z-[100] shadow-sm relative shrink-0">
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex items-center gap-3 pr-5 border-r border-gray-100 tracking-tight">
             <div className="w-9 h-9 flex items-center justify-center bg-gray-900 text-white rounded-xl font-bold text-[18px] shadow-lg">V</div>
             <div className="flex flex-col">
                <span className="text-[14px] font-bold leading-tight">VSBuilder</span>
                <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">{shop.split('.')[0]}</span>
             </div>
          </div>

          <button className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-200 group">
             <span className="text-[13px] font-bold text-gray-700">Home page</span>
             <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-900" />
          </button>
        </div>

        {/* DEVICE TOGGLE */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-[#F3F4F6] p-1.5 rounded-2xl border border-gray-100 shadow-inner">
           <button
             onClick={() => store.setDevice("desktop")}
             className={clsx("p-2 rounded-xl transition-all duration-300", store.device === "desktop" ? "bg-white shadow-lg text-blue-600 scale-105" : "text-gray-400 hover:text-gray-600")}
           >
             <ComputerDesktopIcon className="w-5 h-5" />
           </button>
           <button
             onClick={() => store.setDevice("mobile")}
             className={clsx("p-2 rounded-xl transition-all duration-300", store.device === "mobile" ? "bg-white shadow-lg text-blue-600 scale-105" : "text-gray-400 hover:text-gray-600")}
           >
             <DevicePhoneMobileIcon className="w-5 h-5" />
           </button>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5 mr-2">
              <button className="p-2 hover:bg-gray-50 rounded-lg text-gray-300" disabled><ArrowUturnLeftIcon className="w-5 h-5" /></button>
              <button className="p-2 hover:bg-gray-50 rounded-lg text-gray-300" disabled><ArrowUturnRightIcon className="w-5 h-5" /></button>
           </div>

           <button className="px-5 py-2 text-[13px] font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Publish</button>
           <button className="px-8 py-2.5 bg-gray-900 text-white text-[13px] font-black rounded-xl hover:bg-black shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all active:scale-95 ring-4 ring-black/5">
             Save Changes
           </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">

        {/* SIDEBAR: RECURSIVE JSON ENGINE */}
        <aside className="w-[310px] bg-white border-r border-gray-200 flex flex-col z-[40] shrink-0 shadow-xl shadow-black/5">
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-6 space-y-10">

             {/* Dynamic Groups Mapping */}
             {[
               { id: 'header', label: 'Header', data: store.headerGroup },
               { id: 'template', label: 'Template', data: store.template },
               { id: 'footer', label: 'Footer', data: store.footerGroup }
             ].map(group => (
               <section key={group.id}>
                 <div className="flex items-center justify-between px-4 mb-4">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-[.15em]">{group.label}</span>
                    <PlusIcon className="w-4 h-4 text-gray-300 cursor-pointer hover:text-blue-500 transition-colors" />
                 </div>

                 <div className="space-y-1">
                   {group.data?.order?.map((id: string) => (
                      <SectionNode
                        key={id}
                        id={id}
                        section={group.data.sections[id]}
                        isActive={store.selectedId === id}
                        onClick={() => store.selectNode(id)}
                      />
                   ))}
                   {group.id === 'template' && (
                     <button className="w-full mt-4 py-4 border-2 border-dashed border-gray-100 rounded-2xl text-[12px] font-black text-blue-500 bg-blue-50/20 hover:bg-blue-50 transition-all">
                       + ADD SECTION
                     </button>
                   )}
                 </div>
               </section>
             ))}

          </div>
        </aside>

        {/* WORKSPACE: THE INFINITE CANVAS */}
        <main className="flex-1 bg-[#F9FAFB] relative flex items-center justify-center p-8 overflow-hidden">
           {/* Engineering Grid */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(#000 1px, transparent 1px)`, backgroundSize: '30px 30px' }} />

           <motion.div
              layout
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className={clsx(
                "bg-white shadow-[0_100px_100px_-50px_rgba(0,0,0,0.15)] ring-1 ring-black/5 relative overflow-hidden",
                store.device === "mobile"
                  ? "w-[390px] h-full rounded-[60px] border-[14px] border-gray-900"
                  : "w-full h-full rounded-[20px]"
              )}
           >
              <iframe
                src="/"
                className="w-full h-full pointer-events-none"
                style={{ filter: "brightness(0.98)" }}
              />

              {/* Overlay to catch interactions when dragging */}
              {/* <div className="absolute inset-0 z-20" /> */}
           </motion.div>
        </main>

        {/* INSPECTOR: THE DYNAMIC FORM ENGINE */}
        <aside className="w-[360px] bg-white border-l border-gray-200 flex flex-col z-[40] shrink-0 shadow-2xl">
          <AnimatePresence mode="wait">
            <Inspector key={store.selectedId} id={store.selectedId} section={activeSection} />
          </AnimatePresence>
        </aside>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 20px; }
        .font-sans { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  );
}
