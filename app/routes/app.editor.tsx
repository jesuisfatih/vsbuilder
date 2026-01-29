import { closestCenter, DndContext } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    ArrowLeftIcon,
    CloudArrowUpIcon,
    Cog6ToothIcon,
    ComputerDesktopIcon,
    DevicePhoneMobileIcon,
    EyeIcon,
    PlusIcon,
    Squares2X2Icon
} from "@heroicons/react/24/outline";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Fullscreen } from "@shopify/app-bridge/actions";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";

// --- Types ---
type Section = {
  id: string;
  type: string;
  name: string;
  settings: Record<string, any>;
};

// --- Loader ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  // Mock Data: Gerçekte Theme API'den gelecek
  const mockSections: Section[] = [
    { id: "1", type: "header", name: "Header", settings: {} },
    { id: "2", type: "hero-slider", name: "Hero Slider", settings: { title: "Welcome" } },
    { id: "3", type: "product-grid", name: "Featured Products", settings: { limit: 4 } },
    { id: "4", type: "footer", name: "Footer", settings: {} },
  ];
  return json({ sections: mockSections });
};

// --- Sortable Item Component ---
function SortableItem({ id, name, active }: { id: string, name: string, active: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "group flex items-center gap-3 p-3 mb-2 rounded-lg cursor-grab active:cursor-grabbing transition-all border",
        active
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
      )}
    >
      <Squares2X2Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
      <span className={clsx("text-sm font-medium", active ? "text-blue-700" : "text-gray-700")}>
        {name}
      </span>
    </div>
  );
}

// --- Main Editor Component ---
export default function Editor() {
  const { sections: initialSections } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  const [sections, setSections] = useState<Section[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [isSaving, setIsSaving] = useState(false);

  // Fullscreen Enforce
  useEffect(() => {
    const fullscreen = Fullscreen.create(shopify);
    fullscreen.dispatch(Fullscreen.Action.ENTER);
    return () => { fullscreen.dispatch(Fullscreen.Action.EXIT); };
  }, [shopify]);

  // Drag End Handler
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
       // Reorder logic (basitleştirilmiş)
       console.log("Reordered");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f1f1f1] font-sans antialiased overflow-hidden">

      {/* 1. TOP BAR */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-6">
           <button onClick={() => history.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
             <ArrowLeftIcon className="w-5 h-5" />
           </button>
           <div>
             <h1 className="text-base font-bold text-gray-900 tracking-tight">Main Page</h1>
             <span className="text-xs text-green-600 font-medium flex items-center gap-1">
               <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Live on Store
             </span>
           </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
           <button
             onClick={() => setDeviceMode("desktop")}
             className={clsx("p-2 rounded-md transition-all", deviceMode === "desktop" ? "bg-white shadow text-black" : "text-gray-500 hover:text-gray-700")}
           >
             <ComputerDesktopIcon className="w-5 h-5" />
           </button>
           <button
             onClick={() => setDeviceMode("mobile")}
             className={clsx("p-2 rounded-md transition-all", deviceMode === "mobile" ? "bg-white shadow text-black" : "text-gray-500 hover:text-gray-700")}
           >
             <DevicePhoneMobileIcon className="w-5 h-5" />
           </button>
        </div>

        <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <EyeIcon className="w-4 h-4" /> Preview
           </button>
           <button
             onClick={() => setIsSaving(true)}
             className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-800 shadow-lg shadow-gray-200/50 transition-all active:scale-95"
           >
              {isSaving ? "Saving..." : <><CloudArrowUpIcon className="w-4 h-4" /> Save</>}
           </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* 2. LEFT SIDEBAR (SECTIONS) */}
        <div className="w-[320px] bg-white border-r border-gray-200 flex flex-col shrink-0 z-40">
           <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Layers</h2>
              <button className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors">
                <PlusIcon className="w-4 h-4" />
              </button>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sections} strategy={verticalListSortingStrategy}>
                  {sections.map((section) => (
                    <div key={section.id} onClick={() => setActiveSectionId(section.id)}>
                      <SortableItem
                         id={section.id}
                         name={section.name}
                         active={activeSectionId === section.id}
                      />
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
           </div>

           <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
             <button className="w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors dashed-border">
               + Add Section
             </button>
           </div>
        </div>

        {/* 3. CENTER (CANVAS) */}
        <div className="flex-1 bg-[#e4e5e7] relative flex items-center justify-center overflow-hidden w-full h-full">
           {/* Grid Pattern Background */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
           />

           <div className={clsx(
             "transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] shadow-2xl bg-white overflow-hidden ring-1 ring-black/5",
             deviceMode === "mobile"
               ? "w-[375px] h-[812px] rounded-[40px] border-[8px] border-gray-900"
               : "w-[95%] h-[92%] rounded-xl"
           )}>
              <iframe
                src="/"
                title="Preview"
                className="w-full h-full border-none bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
           </div>
        </div>

        {/* 4. RIGHT SIDEBAR (SETTINGS) */}
        <div className="w-[340px] bg-white border-l border-gray-200 flex flex-col shrink-0 z-40">
           <div className="h-14 border-b border-gray-100 flex items-center px-5 bg-gray-50/50">
             <h2 className="text-sm font-bold text-gray-800">
               {activeSectionId ? sections.find(s => s.id === activeSectionId)?.name : "Settings"}
             </h2>
           </div>

           <div className="flex-1 overflow-y-auto p-0">
             {activeSectionId ? (
                <div className="space-y-6 p-5">
                   {/* Mock Controls - Gelecekte Dinamik Olacak */}
                   <div className="space-y-2">
                     <label className="text-xs font-semibold text-gray-600 uppercase">Heading</label>
                     <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-shadow" placeholder="Enter title" />
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-semibold text-gray-600 uppercase">Description</label>
                     <textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-shadow resize-none" placeholder="Enter content" />
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-semibold text-gray-600 uppercase">Color Scheme</label>
                     <div className="flex gap-2">
                        <button className="w-8 h-8 rounded-full bg-black ring-2 ring-offset-2 ring-gray-300"></button>
                        <button className="w-8 h-8 rounded-full bg-blue-600"></button>
                        <button className="w-8 h-8 rounded-full bg-green-500"></button>
                        <button className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-400 hover:bg-gray-50">+</button>
                     </div>
                   </div>

                   <div className="pt-4 border-t border-gray-100">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-10 h-6 bg-gray-200 rounded-full relative group-hover:bg-gray-300 transition-colors">
                           <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                        <span className="text-sm text-gray-600 selection:bg-none">Show on mobile</span>
                      </label>
                   </div>
                </div>
             ) : (
               <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
                    <Cog6ToothIcon className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">Select a section from the<br />left panel to edit settings.</p>
               </div>
             )}
           </div>
        </div>

      </div>
    </div>
  );
}
