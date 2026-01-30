import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars2Icon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EyeIcon,
  PlusCircleIcon,
  Square3Stack3DIcon,
  Squares2X2Icon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { authenticate } from "../shopify.server";
import { useEditorStore } from "../store/useEditorStore";
import "../styles/editor.css";
import { getActiveThemeId, getThemeAsset } from "../utils/theme.server";

/**
 * LOADER - Fetches theme data from Shopify
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (!admin?.rest?.resources) {
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
 * ICON Components for Section Types
 */
const SectionIcon = ({ type }: { type?: string }) => {
  // Header/Footer icons
  if (type === 'header') return <Squares2X2Icon className="w-4 h-4" />;
  if (type === 'footer') return <Squares2X2Icon className="w-4 h-4" />;
  return <Square3Stack3DIcon className="w-4 h-4" />;
};

/**
 * NAV ITEM - Section/Block List Item (Shopify Style)
 */
interface NavItemProps {
  id: string;
  section: any;
  isActive: boolean;
  onClick: () => void;
  depth?: number;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const NavItem = ({ id, section, isActive, onClick, depth = 0, hasChildren, isExpanded, onToggleExpand }: NavItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sectionName = section?.type?.replace(/-/g, " ").replace(/_/g, " ") || "Section";
  const displayName = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);

  return (
    <motion.li
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "editor-navitem",
        isActive && "editor-navitem--selected",
        depth > 0 && "editor-navitem--nested",
        isDragging && "opacity-50"
      )}
      onClick={onClick}
    >
      {/* Disclosure Arrow */}
      {hasChildren && (
        <button
          className={clsx(
            "editor-navitem__disclosure",
            isExpanded ? "editor-navitem__disclosure--open" : "editor-navitem__disclosure--closed"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
        >
          <ChevronDownIcon className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Drag Handle (only shows on hover) */}
      <div
        {...attributes}
        {...listeners}
        className="editor-navitem__drag-handle"
      >
        <Bars2Icon className="w-4 h-4" />
      </div>

      {/* Section Icon */}
      <div className="editor-navitem__icon">
        <SectionIcon type={section?.type} />
      </div>

      {/* Title */}
      <span className="editor-navitem__title">{displayName}</span>

      {/* Actions (only show on hover) */}
      <div className="editor-navitem__actions">
        <button className="editor-navitem__action-btn" title="Delete section">
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
        <button className="editor-navitem__action-btn" title="Toggle visibility">
          <EyeIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.li>
  );
};

/**
 * ADD SECTION BUTTON
 */
const AddSectionButton = ({ label = "Add section" }: { label?: string }) => (
  <button className="editor-add-section-btn">
    <div className="editor-add-section-btn__icon">
      <PlusCircleIcon className="w-5 h-5" />
    </div>
    <span>{label}</span>
  </button>
);

/**
 * SETTINGS INSPECTOR PANEL
 */
const Inspector = ({ id, section }: { id: string | null; section: any }) => {
  if (!section) {
    return (
      <div className="editor-empty-state">
        <Square3Stack3DIcon className="editor-empty-state__icon" />
        <p className="editor-empty-state__text">Select a section or block to edit</p>
      </div>
    );
  }

  const sectionName = section?.type?.replace(/-/g, " ").replace(/_/g, " ") || "Section";
  const displayName = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="editor-sidebar-secondary__header">
        <h2 className="editor-sidebar-secondary__title">{displayName}</h2>
        <button className="editor-navitem__action-btn">
          <Bars2Icon className="w-4 h-4" />
        </button>
      </header>

      {/* Settings Content */}
      <div className="editor-sidebar-secondary__content editor-scrollbar">
        {Object.entries(section.settings || {}).map(([key, value]) => (
          <div key={key} className="editor-setting">
            <label className="editor-setting__label">
              {key.replace(/_/g, " ").replace(/-/g, " ")}
            </label>

            {typeof value === 'boolean' ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {value ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  className={clsx(
                    "editor-switch",
                    value && "editor-switch--checked"
                  )}
                >
                  <span className="editor-switch__thumb" />
                </button>
              </div>
            ) : typeof value === 'number' ? (
              <input
                type="number"
                defaultValue={value}
                className="editor-setting__input"
              />
            ) : (
              <input
                type="text"
                defaultValue={value as string}
                className="editor-setting__input"
              />
            )}
          </div>
        ))}

        {Object.keys(section.settings || {}).length === 0 && (
          <p className="text-sm text-gray-400">No settings available for this section.</p>
        )}
      </div>

      {/* Footer */}
      <footer className="editor-sidebar-secondary__footer">
        <button className="editor-remove-btn">
          <TrashIcon className="w-4 h-4" />
          <span>Remove section</span>
        </button>
      </footer>
    </div>
  );
};

/**
 * MAIN EDITOR COMPONENT
 */
export default function Editor() {
  const { initialData, shop } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const shopifyBridge = useAppBridge();
  const store = useEditorStore();
  const [activePanel, setActivePanel] = useState<'sections' | 'settings' | 'apps'>('sections');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExit = () => {
    navigate("/app");
  };

  return (
    <div className="editor-frame editor-theme-light">

      {/* ===== TOP BAR ===== */}
      <nav className="editor-topbar">
        {/* Left: Exit + Theme Name */}
        <div className="editor-topbar__group">
          <button onClick={handleExit} className="editor-topbar__exit-btn">
            <ArrowTopRightOnSquareIcon className="editor-topbar__exit-icon" style={{ transform: 'rotate(180deg)' }} />
            <span className="editor-topbar__title">Exit</span>
          </button>

          <span className="text-gray-300">|</span>

          <span className="editor-topbar__title">{shop.split('.')[0]} Theme</span>

          <span className="editor-topbar__badge">
            <span className="editor-topbar__badge-dot" />
            Live
          </span>
        </div>

        {/* Center: Device Toggle */}
        <div className="editor-topbar__group editor-topbar__group--center">
          <div className="editor-device-toggle">
            <button
              onClick={() => store.setDevice("desktop")}
              className={clsx(
                "editor-device-toggle__btn",
                store.device === "desktop" && "editor-device-toggle__btn--active"
              )}
              title="Desktop preview"
            >
              <ComputerDesktopIcon className="editor-device-toggle__icon" />
            </button>
            <button
              onClick={() => store.setDevice("mobile")}
              className={clsx(
                "editor-device-toggle__btn",
                store.device === "mobile" && "editor-device-toggle__btn--active"
              )}
              title="Mobile preview"
            >
              <DevicePhoneMobileIcon className="editor-device-toggle__icon" />
            </button>
          </div>

          {/* Undo/Redo */}
          <div className="editor-topbar__undo-redo">
            <button className="editor-topbar__undo-btn" disabled title="Undo">
              <ArrowUturnLeftIcon className="w-4 h-4" />
            </button>
            <button className="editor-topbar__undo-btn" disabled title="Redo">
              <ArrowUturnRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Save */}
        <div className="editor-topbar__group">
          <button className="editor-topbar__save-btn">
            Save
          </button>
        </div>
      </nav>

      {/* ===== BODY ===== */}
      <div className="editor-body">

        {/* ACTION BAR (Left Icons) */}
        <aside className="editor-actionbar">
          <ul className="editor-actionbar__list">
            <li>
              <button
                className={clsx(
                  "editor-actionbar__btn",
                  activePanel === 'sections' && "editor-actionbar__btn--active"
                )}
                onClick={() => setActivePanel('sections')}
                title="Sections"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
            </li>
            <li>
              <button
                className={clsx(
                  "editor-actionbar__btn",
                  activePanel === 'settings' && "editor-actionbar__btn--active"
                )}
                onClick={() => setActivePanel('settings')}
                title="Theme settings"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            </li>
          </ul>
        </aside>

        {/* SIDEBAR (Sections List) */}
        <aside className="editor-sidebar">
          <header className="editor-sidebar__header">
            <h1 className="editor-sidebar__template-title">Home page</h1>
          </header>

          <div className="editor-sidebar__content editor-scrollbar">
            {/* Header Group */}
            <div className="editor-section-group">
              <div className="editor-section-group__label">Header</div>
              <ul className="list-none p-0 m-0">
                {store.headerGroup?.order?.map((id: string) => (
                  <NavItem
                    key={id}
                    id={id}
                    section={store.headerGroup.sections[id]}
                    isActive={store.selectedId === id}
                    onClick={() => store.selectNode(id)}
                    hasChildren={!!store.headerGroup.sections[id]?.blocks}
                    isExpanded={expandedSections.has(id)}
                    onToggleExpand={() => toggleSection(id)}
                  />
                ))}
                <li>
                  <AddSectionButton />
                </li>
              </ul>
            </div>

            {/* Template Group */}
            <div className="editor-section-group">
              <div className="editor-section-group__label">Template</div>
              <ul className="list-none p-0 m-0">
                {store.template?.order?.map((id: string) => (
                  <NavItem
                    key={id}
                    id={id}
                    section={store.template.sections[id]}
                    isActive={store.selectedId === id}
                    onClick={() => store.selectNode(id)}
                    hasChildren={!!store.template.sections[id]?.blocks}
                    isExpanded={expandedSections.has(id)}
                    onToggleExpand={() => toggleSection(id)}
                  />
                ))}
                <li>
                  <AddSectionButton />
                </li>
              </ul>
            </div>

            {/* Footer Group */}
            <div className="editor-section-group">
              <div className="editor-section-group__label">Footer</div>
              <ul className="list-none p-0 m-0">
                {store.footerGroup?.order?.map((id: string) => (
                  <NavItem
                    key={id}
                    id={id}
                    section={store.footerGroup.sections[id]}
                    isActive={store.selectedId === id}
                    onClick={() => store.selectNode(id)}
                    hasChildren={!!store.footerGroup.sections[id]?.blocks}
                    isExpanded={expandedSections.has(id)}
                    onToggleExpand={() => toggleSection(id)}
                  />
                ))}
                <li>
                  <AddSectionButton />
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* MAIN PREVIEW AREA */}
        <main className="editor-main">
          <div className="editor-preview">
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={clsx(
                "editor-preview__frame",
                store.device === "mobile" && "editor-preview__frame--mobile"
              )}
            >
              <iframe
                src="/"
                className="editor-preview__iframe"
                title="Store preview"
              />
            </motion.div>
          </div>
        </main>

        {/* SECONDARY SIDEBAR (Inspector) */}
        <aside className="editor-sidebar-secondary">
          <AnimatePresence mode="wait">
            <motion.div
              key={store.selectedId || 'empty'}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Inspector id={store.selectedId} section={activeSection} />
            </motion.div>
          </AnimatePresence>
        </aside>

      </div>
    </div>
  );
}
