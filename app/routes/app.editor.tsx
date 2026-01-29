import {
    closestCenter,
    DndContext
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
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
    EyeSlashIcon,
    PlusIcon,
    TrashIcon
} from "@heroicons/react/24/outline";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Fullscreen } from "@shopify/app-bridge/actions";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";

/**
 * TYPES
 */
interface EditorBlock {
  id: string;
  type: string;
  name: string;
  isVisible: boolean;
}

interface EditorSection {
  id: string;
  type: string;
  name: string;
  isVisible: boolean;
  blocks: EditorBlock[];
}

interface PageData {
  header: EditorSection[];
  template: EditorSection[];
  footer: EditorSection[];
}

/**
 * LOADER
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Real implementasyon Shopify Theme Settings JSON'dan beslenecek
  const initialData: PageData = {
    header: [
      { id: "h1", name: "Announcement bar", type: "header-block", isVisible: true, blocks: [] },
      { id: "h2", name: "Header", type: "header-main", isVisible: true, blocks: [] },
    ],
    template: [
      { id: "s1", name: "HYDRO Floating Widgets", type: "hydro-widgets", isVisible: true, blocks: [] },
      { id: "s2", name: "HYDRO Glass Cards", type: "hydro-cards", isVisible: true, blocks: [] },
      { id: "s3", name: "HYDRO Premium Stats", type: "hydro-stats", isVisible: true, blocks: [] },
    ],
    footer: [
      { id: "f1", name: "Footer", type: "footer", isVisible: true, blocks: [] },
    ]
  };

  return json({ initialData });
};

/**
 * COMPONENTS
 */

const SidebarItem = ({
  item,
  active,
  onClick,
  isChild = false
}: {
  item: EditorSection | EditorBlock,
  active: boolean,
  onClick: () => void,
  isChild?: boolean
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group flex items-center justify-between py-2 px-3 rounded-md cursor-default transition-all duration-200 select-none",
        active ? "bg-[#e2e8f0] text-black shadow-sm" : "hover:bg-[#f1f5f9] text-[#4a5568]",
        isChild && "ml-4"
      )}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <Bars2Icon className="w-4 h-4 text-gray-400" />
        </div>
        <span className="text-[13px] font-medium leading-none truncate max-w-[160px]">
          {item.name}
        </span>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 hover:bg-white rounded transition-colors">
          {item.isVisible ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5 text-red-500" />}
        </button>
      </div>
    </div>
  );
};

const SidebarGroup = ({
  title,
  items,
  activeId,
  onSelect
}: {
  title: string,
  items: EditorSection[],
  activeId: string | null,
  onSelect: (id: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 mb-2 group"
      >
        <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">{title}</span>
        <ChevronDownIcon className={clsx("w-3 h-3 text-gray-400 transition-transform", !isOpen && "-rotate-90")} />
      </button>

      {isOpen && (
        <div className="space-y-0.5 px-1">
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <div key={item.id}>
                <SidebarItem
                  item={item}
                  active={activeId === item.id}
                  onClick={() => onSelect(item.id)}
                />
                {item.blocks && item.blocks.map(block => (
                   <SidebarItem
                    key={block.id}
                    item={block}
                    active={activeId === block.id}
                    onClick={() => onSelect(block.id)}
                    isChild
                  />
                ))}
              </div>
            ))}
          </SortableContext>
          <button className="w-full flex items-center gap-2 px-4 py-2 mt-1 text-[12px] font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
            <PlusIcon className="w-3.5 h-3.5" /> Add section
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * EDITOR MAIN
 */
export default function Editor() {
  const { initialData } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  const [pageData, setPageData] = useState<PageData>(initialData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [isChanged, setIsChanged] = useState(false);

  // Fullscreen Entry
  useEffect(() => {
    const fullscreen = Fullscreen.create(shopify);
    fullscreen.dispatch(Fullscreen.Action.ENTER);
    return () => { fullscreen.dispatch(Fullscreen.Action.EXIT); };
  }, [shopify]);

  const selectedItem = [...pageData.header, ...pageData.template, ...pageData.footer].find(i => i.id === selectedId);

  return (
    <div className="h-screen flex flex-col bg-[#f6f6f7] text-[#1a1c1e] antialiased overflow-hidden font-inter select-none">

      {/* HEADER / NAVIGATION BAR */}
      <nav className="h-[52px] bg-white border-b border-[#d1d5db] flex items-center justify-between px-4 z-[100] relative">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
             <div className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-lg font-black text-lg">V</div>
             <div className="flex flex-col leading-tight">
                <span className="text-[14px] font-semibold text-gray-900 leading-none">VSBuilder</span>
                <span className="text-[10px] text-gray-500 font-medium">techify-BEHYDRO-v5-Theme</span>
             </div>
          </div>

          {/* PAGE SELECTOR */}
          <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-md transition-colors">
             <span className="text-[13px] font-medium">Home page</span>
             <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        {/* VIEWPORT CONTROLS */}
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-lg">
           <button
             onClick={() => setDevice("desktop")}
             className={clsx("p-1.5 rounded-md", device === "desktop" ? "bg-white shadow-sm text-black" : "text-gray-400 hover:text-gray-600")}
           >
             <ComputerDesktopIcon className="w-4 h-4" />
           </button>
           <button
             onClick={() => setDevice("mobile")}
             className={clsx("p-1.5 rounded-md", device === "mobile" ? "bg-white shadow-sm text-black" : "text-gray-400 hover:text-gray-600")}
           >
             <DevicePhoneMobileIcon className="w-4 h-4" />
           </button>
        </div>

        <div className="flex items-center justify-end gap-3 flex-1">
           <div className="flex items-center gap-1.5 mr-4 text-gray-400">
             <button className="p-1.5 hover:text-gray-600 disabled:opacity-30"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
             <button className="p-1.5 hover:text-gray-600 disabled:opacity-30"><ArrowUturnRightIcon className="w-4 h-4" /></button>
           </div>
           <button className="px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 rounded-md">Publish</button>
           <button className={clsx(
             "px-5 py-1.5 text-[13px] font-bold rounded-md transition-all shadow-lg shadow-black/10 active:scale-[0.98]",
             isChanged ? "bg-[#008060] text-white hover:bg-[#006e52]" : "bg-white border border-[#d1d5db] text-gray-400 cursor-not-allowed"
           )}>
             Save
           </button>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR: THE TREE */}
        <aside className="w-[280px] bg-white border-r border-[#d1d5db] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto px-2 pt-4 custom-scrollbar">
             <DndContext collisionDetection={closestCenter}>
               <SidebarGroup
                 title="Header"
                 items={pageData.header}
                 activeId={selectedId}
                 onSelect={setSelectedId}
               />
               <SidebarGroup
                 title="Template"
                 items={pageData.template}
                 activeId={selectedId}
                 onSelect={setSelectedId}
               />
               <SidebarGroup
                 title="Footer"
                 items={pageData.footer}
                 activeId={selectedId}
                 onSelect={setSelectedId}
               />
             </DndContext>
          </div>
        </aside>

        {/* CENTER: LIVE PREVIEW */}
        <main className="flex-1 bg-[#e4e5e7] relative flex items-center justify-center p-4">
           {/* Device Frame */}
           <div className={clsx(
              "bg-white shadow-[0_40px_100px_rgba(0,0,0,0.15)] ring-1 ring-black/5 relative transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]",
              device === "mobile"
                ? "w-[375px] h-full max-h-[780px] rounded-[48px] border-[12px] border-[#1e293b]"
                : "w-full h-full rounded-lg"
           )}>
              {/* Device Notch for mobile */}
              {device === "mobile" && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1e293b] rounded-b-2xl z-20 flex items-center justify-center">
                   <div className="w-10 h-1 bg-gray-800 rounded-full"></div>
                </div>
              )}

              <iframe
                src="/"
                className="w-full h-full rounded-none"
                style={{ borderRadius: device === "mobile" ? "36px" : "4px" }}
              />
           </div>
        </main>

        {/* RIGHT SIDEBAR: INSPECTOR */}
        <aside className="w-[320px] bg-white border-l border-[#d1d5db] flex flex-col shrink-0">
          {selectedItem ? (
            <>
              <div className="h-14 flex items-center justify-between px-5 border-b border-gray-100 flex-none bg-[#f8fafc]">
                <h3 className="text-[14px] font-bold text-gray-900">{selectedItem.name}</h3>
                <button className="p-1.5 hover:bg-gray-200 rounded text-gray-400"><EllipsisHorizontalIcon className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">

                {/* DYNAMIC SETTINGS SIMULATION */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-tighter">Visibility</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#008060]"></div>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-semibold text-gray-500 uppercase">Text Alignment</label>
                  <div className="grid grid-cols-3 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                    <button className="bg-white py-2 text-xs font-medium hover:bg-gray-50">Left</button>
                    <button className="bg-gray-50 py-2 text-xs font-bold text-blue-600">Center</button>
                    <button className="bg-white py-2 text-xs font-medium hover:bg-gray-50">Right</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-semibold text-gray-500 uppercase">Custom CSS</label>
                  <pre className="bg-[#1e293b] text-blue-300 p-3 rounded-lg text-xs leading-relaxed font-mono overflow-x-auto">
                    .custom-class {"{"}
                      color: red;
                    {"}"}
                  </pre>
                </div>

              </div>

              <div className="p-5 border-t border-gray-100 mt-auto bg-gray-50">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-md transition-all">
                  <TrashIcon className="w-4 h-4" /> Remove section
                </button>
              </div>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-4 opacity-40">
                <ArchiveBoxIcon className="w-12 h-12 text-gray-300" />
                <p className="text-sm font-medium text-gray-500 leading-relaxed">Select an element to customize its appearance</p>
             </div>
          )}
        </aside>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .font-inter { font-family: 'Inter', -apple-system, sans-serif; }
      `}</style>
    </div>
  );
}
