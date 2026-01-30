/**
 * 🏛️ ULTRA EDITOR - Shopify Theme Customizer Clone
 * TIER 1 Implementation: DnD, Save, Blocks, Live Preview
 * Enterprise-grade architecture with full feature parity
 */
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars2Icon,
  CheckIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  PlusCircleIcon,
  ShoppingBagIcon,
  Square3Stack3DIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDefaultSettings,
  SECTION_CATEGORIES,
  SECTION_TEMPLATES,
} from "../config/sectionTemplates";
import {
  THEME_SETTINGS_SCHEMA,
  type ThemeSettingInput,
} from "../config/themeSettings";
import { authenticate } from "../shopify.server";
import {
  useEditorStore,
  type Block,
  type GroupType,
  type Section,
} from "../store/useEditorStore";
import "../styles/editor.css";
import { getActiveThemeId, getThemeAsset } from "../utils/theme.server";

// ============================================
// LOADER
// ============================================

// Available template types
const TEMPLATE_TYPES = [
  { value: "index", label: "Home page", path: "templates/index.json" },
  { value: "product", label: "Product pages", path: "templates/product.json" },
  { value: "collection", label: "Collection pages", path: "templates/collection.json" },
  { value: "page", label: "Pages", path: "templates/page.json" },
  { value: "blog", label: "Blog", path: "templates/blog.json" },
  { value: "article", label: "Article", path: "templates/article.json" },
  { value: "cart", label: "Cart", path: "templates/cart.json" },
  { value: "search", label: "Search results", path: "templates/search.json" },
  { value: "404", label: "404 page", path: "templates/404.json" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const templateParam = url.searchParams.get("template") || "index";

    if (!admin || !session) {
      return json({
        shop: "demo-shop",
        themeId: null,
        currentTemplate: templateParam,
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] },
          header: { sections: {}, order: [] },
          footer: { sections: {}, order: [] },
        },
        previewUrl: "/",
        error: "Session not fully initialized. Please refresh the page.",
      });
    }

    const themeId = await getActiveThemeId(admin);
    if (!themeId) {
      return json({
        shop: session.shop,
        themeId: null,
        currentTemplate: templateParam,
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] },
          header: { sections: {}, order: [] },
          footer: { sections: {}, order: [] },
        },
        previewUrl: "/",
        error: "No active theme found",
      });
    }

    // Get template path from param
    const templateConfig = TEMPLATE_TYPES.find(t => t.value === templateParam) || TEMPLATE_TYPES[0];

    const [templateData, headerGroup, footerGroup] = await Promise.all([
      getThemeAsset(admin, themeId.toString(), templateConfig.path).catch(() => null),
      getThemeAsset(admin, themeId.toString(), "sections/header-group.json").catch(() => null),
      getThemeAsset(admin, themeId.toString(), "sections/footer-group.json").catch(() => null),
    ]);

    // Build preview URL based on template type
    let previewPath = "/";
    switch (templateParam) {
      case "product": previewPath = "/products"; break;
      case "collection": previewPath = "/collections/all"; break;
      case "page": previewPath = "/pages"; break;
      case "blog": previewPath = "/blogs/news"; break;
      case "article": previewPath = "/blogs/news"; break;
      case "cart": previewPath = "/cart"; break;
      case "search": previewPath = "/search"; break;
      case "404": previewPath = "/404"; break;
    }

    const previewUrl = `https://${session.shop}${previewPath}?preview_theme_id=${themeId}`;

    return json({
      shop: session.shop,
      themeId: themeId.toString(),
      currentTemplate: templateParam,
      availableTemplates: TEMPLATE_TYPES,
      initialData: {
        template: templateData || { sections: {}, order: [] },
        header: headerGroup || { sections: {}, order: [] },
        footer: footerGroup || { sections: {}, order: [] },
      },
      previewUrl,
    });
  } catch (error) {
    console.error("[Editor] Loader error:", error);
    return json({
      shop: "demo-shop",
      themeId: null,
      currentTemplate: "index",
      availableTemplates: TEMPLATE_TYPES,
      initialData: {
        template: { sections: {}, order: [] },
        header: { sections: {}, order: [] },
        footer: { sections: {}, order: [] },
      },
      previewUrl: "/",
      error: "Failed to load editor. Please try again.",
    });
  }
};

// ============================================
// ICON COMPONENT
// ============================================

const SectionIcon = ({ type, disabled }: { type?: string; disabled?: boolean }) => {
  const iconClass = clsx("w-4 h-4", disabled && "opacity-50");
  if (type?.includes("header")) return <Squares2X2Icon className={iconClass} />;
  if (type?.includes("footer")) return <Squares2X2Icon className={iconClass} />;
  return <Square3Stack3DIcon className={iconClass} />;
};

// ============================================
// SORTABLE NAV ITEM (Section/Block)
// ============================================

interface NavItemProps {
  id: string;
  section: Section;
  groupType: GroupType;
  isSelected: boolean;
  isExpanded: boolean;
  hasBlocks: boolean;
}

const SortableNavItem = ({
  id,
  section,
  groupType,
  isSelected,
  isExpanded,
  hasBlocks,
}: NavItemProps) => {
  const store = useEditorStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = section?.type
    ?.replace(/-/g, " ")
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Section";

  const handleClick = () => {
    store.selectSection(groupType, id);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    store.toggleExpanded(id);
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    store.pushHistory(`Toggle visibility: ${displayName}`);
    store.toggleSectionVisibility(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${displayName}"?`)) {
      store.deleteSection(groupType, id);
    }
  };

  return (
    <>
      <motion.li
        ref={setNodeRef}
        style={style}
        layout
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
        className={clsx(
          "editor-navitem",
          isSelected && "editor-navitem--selected",
          section.disabled && "editor-navitem--disabled"
        )}
        onClick={handleClick}
      >
        {/* Disclosure Arrow */}
        {hasBlocks && (
          <button
            className={clsx(
              "editor-navitem__disclosure",
              isExpanded
                ? "editor-navitem__disclosure--open"
                : "editor-navitem__disclosure--closed"
            )}
            onClick={handleToggleExpand}
          >
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Drag Handle */}
        <div {...attributes} {...listeners} className="editor-navitem__drag-handle">
          <Bars2Icon className="w-4 h-4" />
        </div>

        {/* Icon */}
        <div className="editor-navitem__icon">
          <SectionIcon type={section.type} disabled={section.disabled} />
        </div>

        {/* Title */}
        <span className={clsx("editor-navitem__title", section.disabled && "editor-navitem__title--disabled")}>
          {displayName}
        </span>

        {/* Actions */}
        <div className="editor-navitem__actions">
          <button
            className="editor-navitem__action-btn"
            onClick={handleToggleVisibility}
            title={section.disabled ? "Show section" : "Hide section"}
          >
            {section.disabled ? (
              <EyeSlashIcon className="w-3.5 h-3.5" />
            ) : (
              <EyeIcon className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            className="editor-navitem__action-btn"
            onClick={handleDelete}
            title="Delete section"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.li>

      {/* Nested Blocks */}
      {hasBlocks && isExpanded && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="editor-blocks-list"
        >
          {section.block_order?.map((blockId) => {
            const block = section.blocks?.[blockId];
            if (!block) return null;
            return (
              <BlockItem
                key={blockId}
                blockId={blockId}
                block={block}
                sectionId={id}
                groupType={groupType}
                isSelected={store.selectedPath?.blockId === blockId}
              />
            );
          })}
          <li>
            <button
              className="editor-add-section-btn ml-6 text-xs"
              onClick={() => store.addBlock(id, "text")}
            >
              <PlusCircleIcon className="w-4 h-4" />
              <span>Add block</span>
            </button>
          </li>
        </motion.ul>
      )}
    </>
  );
};

// ============================================
// BLOCK ITEM
// ============================================

interface BlockItemProps {
  blockId: string;
  block: Block;
  sectionId: string;
  groupType: GroupType;
  isSelected: boolean;
}

const BlockItem = ({ blockId, block, sectionId, groupType, isSelected }: BlockItemProps) => {
  const store = useEditorStore();

  const displayName = block?.type
    ?.replace(/-/g, " ")
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Block";

  const handleClick = () => {
    store.selectBlock(groupType, sectionId, blockId);
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    store.toggleBlockVisibility(sectionId, blockId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${displayName}"?`)) {
      store.deleteBlock(sectionId, blockId);
    }
  };

  return (
    <li
      className={clsx(
        "editor-navitem editor-navitem--nested",
        isSelected && "editor-navitem--selected",
        block.disabled && "editor-navitem--disabled"
      )}
      onClick={handleClick}
    >
      {/* Bullet */}
      <div className="editor-navitem__bullet-wrapper">
        <div className="editor-navitem__bullet" />
      </div>

      {/* Title */}
      <span className={clsx("editor-navitem__title", block.disabled && "editor-navitem__title--disabled")}>
        {displayName}
      </span>

      {/* Actions */}
      <div className="editor-navitem__actions">
        <button
          className="editor-navitem__action-btn"
          onClick={handleToggleVisibility}
          title={block.disabled ? "Show block" : "Hide block"}
        >
          {block.disabled ? (
            <EyeSlashIcon className="w-3.5 h-3.5" />
          ) : (
            <EyeIcon className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          className="editor-navitem__action-btn"
          onClick={handleDelete}
          title="Delete block"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
};

// ============================================
// SECTION GROUP
// ============================================

interface SectionGroupProps {
  groupType: GroupType;
  label: string;
  sections: Record<string, Section>;
  order: string[];
  searchFilter?: string;
}

const SectionGroup = ({ groupType, label, sections, order, searchFilter = "" }: SectionGroupProps) => {
  const store = useEditorStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter sections by search
  const filteredOrder = order.filter((sectionId) => {
    if (!searchFilter.trim()) return true;
    const section = sections[sectionId];
    if (!section) return false;
    const sectionName = section.label || section.type || "";
    return sectionName.toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <>
      <div className="editor-section-group">
        <div className="editor-section-group__label">{label}</div>
        <SortableContext items={filteredOrder} strategy={verticalListSortingStrategy}>
          <ul className="editor-navlist">
            {filteredOrder.map((id) => {
              const section = sections[id];
              if (!section) return null;

              const hasBlocks = !!(section.blocks && Object.keys(section.blocks).length > 0);

              return (
                <SortableNavItem
                  key={id}
                  id={id}
                  section={section}
                  groupType={groupType}
                  isSelected={store.selectedPath?.sectionId === id && !store.selectedPath?.blockId}
                  isExpanded={store.expandedSections.has(id)}
                  hasBlocks={hasBlocks}
                />
              );
            })}
            <li>
              <button
                className="editor-add-section-btn"
                onClick={() => setIsModalOpen(true)}
              >
                <PlusCircleIcon className="editor-icon--md" />
                <span>Add section</span>
              </button>
            </li>
          </ul>
        </SortableContext>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <SectionPickerModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            groupType={groupType}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ============================================
// SECTION PICKER MODAL
// ============================================

// Categories derived from config
const CATEGORIES = SECTION_CATEGORIES.map((c) => c.name);

interface SectionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupType: GroupType;
}

const SectionPickerModal = ({ isOpen, onClose, groupType }: SectionPickerModalProps) => {
  const store = useEditorStore();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredSections = SECTION_TEMPLATES.filter((section) => {
    const matchesSearch = section.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory ||
      section.category.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleSelect = (sectionType: string) => {
    const defaultSettings = getDefaultSettings(sectionType);
    store.addSection(groupType, sectionType, undefined, defaultSettings as Record<string, string | number | boolean | null>);
    onClose();
    setSearch("");
    setActiveCategory(null);
  };

  if (!isOpen) return null;

  return (
    <div className="editor-modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="editor-modal__header">
          <h2 className="editor-modal__title">Add section</h2>
          <button className="editor-modal__close" onClick={onClose}>
            <XMarkIcon className="editor-icon--sm" />
          </button>
        </header>

        {/* Search */}
        <div className="editor-modal__search">
          <div className="editor-search-input">
            <MagnifyingGlassIcon className="editor-search-input__icon" />
            <input
              type="text"
              placeholder="Search sections..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="editor-search-input__field"
              autoFocus
            />
          </div>
        </div>

        {/* Categories */}
        <div className="editor-modal__categories">
          <button
            className={clsx(
              "editor-category-btn",
              !activeCategory && "editor-category-btn--active"
            )}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={clsx(
                "editor-category-btn",
                activeCategory === cat && "editor-category-btn--active"
              )}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sections Grid */}
        <div className="editor-modal__content editor-scrollbar">
          <div className="editor-section-grid">
            {filteredSections.map((section) => (
              <button
                key={section.type}
                className="editor-section-card"
                onClick={() => handleSelect(section.type)}
              >
                <div className="editor-section-card__preview">
                  <Square3Stack3DIcon className="editor-section-card__icon" />
                </div>
                <div className="editor-section-card__info">
                  <span className="editor-section-card__name">{section.name}</span>
                  <span className="editor-section-card__category">{section.category}</span>
                </div>
              </button>
            ))}
          </div>

          {filteredSections.length === 0 && (
            <div className="editor-empty-state">
              <p className="editor-empty-text">No sections found</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ============================================
// RESOURCE PICKER MODAL (Products, Collections, Files)
// ============================================

interface ResourceItem {
  id: string;
  title: string;
  handle?: string;
  price?: string;
  meta?: string;
  image?: string | null;
  imageAlt?: string;
  url?: string;
  type: "product" | "collection" | "page" | "file";
}

interface ResourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (resource: ResourceItem) => void;
  resourceType: "products" | "collections" | "pages" | "files";
  title?: string;
  selectedId?: string;
}

const ResourcePickerModal = ({
  isOpen,
  onClose,
  onSelect,
  resourceType,
  title,
  selectedId,
}: ResourcePickerModalProps) => {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const displayTitle = title || resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  // Fetch resources
  const fetchResources = useCallback(async (searchQuery: string, afterCursor?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: resourceType,
        search: searchQuery,
        limit: "20",
      });
      if (afterCursor) params.set("cursor", afterCursor);

      const response = await fetch(`/api/resources?${params}`);
      const data = await response.json();

      if (afterCursor) {
        setItems(prev => [...prev, ...data.items]);
      } else {
        setItems(data.items || []);
      }
      setHasMore(data.pageInfo?.hasNextPage || false);
      setCursor(data.pageInfo?.endCursor || null);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
    } finally {
      setLoading(false);
    }
  }, [resourceType]);

  // Initial load and search
  useEffect(() => {
    if (isOpen) {
      const debounce = setTimeout(() => {
        fetchResources(search, null);
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [isOpen, search, fetchResources]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setItems([]);
      setCursor(null);
    }
  }, [isOpen]);

  const handleSelect = (item: ResourceItem) => {
    onSelect(item);
    onClose();
  };

  const handleLoadMore = () => {
    if (hasMore && cursor && !loading) {
      fetchResources(search, cursor);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="editor-modal-overlay" onClick={onClose}>
      <motion.div
        className="editor-modal editor-resource-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        {/* Header */}
        <header className="editor-modal__header">
          <h2 className="editor-modal__title">Select {displayTitle}</h2>
          <button className="editor-modal__close" onClick={onClose}>
            <XMarkIcon className="w-5 h-5" />
          </button>
        </header>

        {/* Search */}
        <div className="editor-modal__search">
          <MagnifyingGlassIcon className="editor-modal__search-icon" />
          <input
            type="text"
            placeholder={`Search ${resourceType}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="editor-modal__search-input"
            autoFocus
          />
        </div>

        {/* Resource Grid */}
        <div className="editor-modal__content editor-scrollbar">
          {loading && items.length === 0 ? (
            <div className="editor-empty-state">
              <div className="editor-spinner" />
              <p className="editor-empty-text">Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="editor-empty-state">
              <Square3Stack3DIcon className="editor-empty-state__icon" />
              <p className="editor-empty-text">No {resourceType} found</p>
            </div>
          ) : (
            <>
              <div className="editor-resource-grid">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={clsx(
                      "editor-resource-item",
                      selectedId === item.id && "editor-resource-item--selected"
                    )}
                    onClick={() => handleSelect(item)}
                  >
                    {item.image || item.url ? (
                      <img
                        src={item.image || item.url}
                        alt={item.imageAlt || item.title}
                        className="editor-resource-item__image"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="editor-resource-item__image editor-resource-item__image--placeholder">
                        {resourceType === "products" && <ShoppingBagIcon className="w-8 h-8" />}
                        {resourceType === "collections" && <Square3Stack3DIcon className="w-8 h-8" />}
                        {resourceType === "pages" && <DocumentTextIcon className="w-8 h-8" />}
                        {resourceType === "files" && <PhotoIcon className="w-8 h-8" />}
                      </div>
                    )}
                    <div className="editor-resource-item__info">
                      <span className="editor-resource-item__title">{item.title}</span>
                      {item.price && (
                        <span className="editor-resource-item__price">{item.price}</span>
                      )}
                      {item.meta && (
                        <span className="editor-resource-item__meta">{item.meta}</span>
                      )}
                    </div>
                    {selectedId === item.id && (
                      <div className="editor-resource-item__check">
                        <CheckIcon className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {hasMore && (
                <div className="editor-resource-load-more">
                  <button
                    className="editor-btn editor-btn--secondary"
                    onClick={handleLoadMore}
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ============================================
// THEME SETTINGS PANEL
// ============================================

const ThemeSettingField = ({
  setting,
  value,
  onChange
}: {
  setting: ThemeSettingInput;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  switch (setting.type) {
    case "color":
      return (
        <div className="editor-setting">
          <label className="editor-setting__label">{setting.label}</label>
          <div className="editor-color-picker">
            <button
              className="editor-color-picker__trigger"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <span
                className="editor-color-picker__swatch"
                style={{ backgroundColor: (value as string) || setting.default as string || "#ffffff" }}
              />
              <span className="editor-color-picker__value">
                {(value as string) || setting.default || "Select color"}
              </span>
            </button>
            {showColorPicker && (
              <div className="editor-color-picker__popover">
                <div
                  className="editor-color-picker__overlay"
                  onClick={() => setShowColorPicker(false)}
                />
                <div className="editor-color-picker__panel">
                  <div className="editor-color-picker__custom">
                    <input
                      type="color"
                      value={(value as string) || setting.default as string || "#ffffff"}
                      onChange={(e) => onChange(e.target.value)}
                      className="editor-color-picker__input"
                    />
                    <input
                      type="text"
                      value={(value as string) || ""}
                      onChange={(e) => onChange(e.target.value)}
                      placeholder="#000000"
                      className="editor-setting__input"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          {setting.info && <p className="editor-setting__info">{setting.info}</p>}
        </div>
      );

    case "range":
      return (
        <div className="editor-setting">
          <div className="editor-setting__row">
            <label className="editor-setting__label">{setting.label}</label>
            <span className="editor-setting__value">
              {value as number ?? setting.default}{setting.unit || ""}
            </span>
          </div>
          <input
            type="range"
            min={setting.min}
            max={setting.max}
            step={setting.step}
            value={value as number ?? setting.default}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="editor-setting__range"
          />
        </div>
      );

    case "select":
      return (
        <div className="editor-setting">
          <label className="editor-setting__label">{setting.label}</label>
          <select
            value={(value as string) ?? setting.default}
            onChange={(e) => onChange(e.target.value)}
            className="editor-setting__select"
          >
            {setting.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "checkbox":
      return (
        <div className="editor-setting">
          <div className="editor-setting__row">
            <label className="editor-setting__label">{setting.label}</label>
            <button
              className={clsx("editor-switch", (value ?? setting.default) && "editor-switch--checked")}
              onClick={() => onChange(!(value ?? setting.default))}
            >
              <span className="editor-switch__thumb" />
            </button>
          </div>
        </div>
      );

    case "font_picker":
      return (
        <div className="editor-setting">
          <label className="editor-setting__label">{setting.label}</label>
          <select
            value={(value as string) ?? setting.default}
            onChange={(e) => onChange(e.target.value)}
            className="editor-setting__select"
          >
            {["Assistant", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Playfair Display", "Libre Baskerville", "DM Sans", "Poppins"].map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </div>
      );

    case "image_picker":
      const hasImage = typeof value === "string" && value.length > 0;
      return (
        <div className="editor-setting">
          <label className="editor-setting__label">{setting.label}</label>
          <div className="editor-image-picker">
            <button
              className={clsx(
                "editor-image-picker__trigger",
                hasImage && "editor-image-picker__trigger--has-image"
              )}
              onClick={() => {
                const url = prompt("Enter image URL:", (value as string) || "");
                if (url !== null) onChange(url);
              }}
            >
              {hasImage ? (
                <img src={value as string} alt={setting.label} className="editor-image-picker__preview" />
              ) : (
                <div className="editor-image-picker__placeholder">
                  <PhotoIcon className="editor-image-picker__placeholder-icon" />
                </div>
              )}
              <div className="editor-image-picker__info">
                {hasImage ? (
                  <span className="editor-image-picker__filename">{(value as string).split("/").pop()}</span>
                ) : (
                  <span className="editor-image-picker__label">Select image</span>
                )}
              </div>
            </button>
          </div>
          {setting.info && <p className="editor-setting__info">{setting.info}</p>}
        </div>
      );

    default:
      return (
        <div className="editor-setting">
          <label className="editor-setting__label">{setting.label}</label>
          <input
            type="text"
            value={(value as string) ?? setting.default ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="editor-setting__input"
          />
          {setting.info && <p className="editor-setting__info">{setting.info}</p>}
        </div>
      );
  }
};

const ThemeSettingsPanel = () => {
  const store = useEditorStore();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Colors"]));

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="editor-theme-settings">
      <header className="editor-sidebar-secondary__header">
        <h2 className="editor-sidebar-secondary__title">Theme settings</h2>
      </header>

      <div className="editor-sidebar-secondary__content editor-scrollbar">
        {THEME_SETTINGS_SCHEMA.map((group) => (
          <div key={group.name} className="editor-settings-group">
            <button
              className={clsx(
                "editor-settings-group__header",
                expandedGroups.has(group.name) && "editor-settings-group__header--expanded"
              )}
              onClick={() => toggleGroup(group.name)}
            >
              <span className="editor-settings-group__title">{group.name}</span>
              <ChevronDownIcon
                className={clsx(
                  "editor-settings-group__chevron",
                  expandedGroups.has(group.name) && "editor-settings-group__chevron--expanded"
                )}
              />
            </button>

            {expandedGroups.has(group.name) && (
              <div className="editor-settings-group__content">
                {group.settings.map((setting) => (
                  <ThemeSettingField
                    key={setting.id}
                    setting={setting}
                    value={store.themeSettings[setting.id]}
                    onChange={(value) => store.updateThemeSetting(setting.id, value)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// SETTINGS INSPECTOR
// ============================================

const SettingsInspector = () => {
  const store = useEditorStore();
  const { type, data, path } = store.getActiveItem();

  if (!data || !path) {
    return (
      <div className="editor-empty-state">
        <Square3Stack3DIcon className="editor-empty-state__icon" />
        <p className="editor-empty-state__text">Select a section or block to edit</p>
      </div>
    );
  }

  // Get section info
  const sectionInfo = store.getSection(path.sectionId);
  const section = sectionInfo.section;

  const sectionName = section?.label || section?.type
    ?.replace(/-/g, " ")
    .replace(/_/g, " ")
    .split(" ")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Section";

  const displayName = type === "block"
    ? (data as any).type
        ?.replace(/-/g, " ")
        .replace(/_/g, " ")
        .split(" ")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ") || "Block"
    : sectionName;

  const handleSettingChange = (key: string, value: any) => {
    if (type === "block" && path.blockId) {
      store.updateBlockSetting(path.sectionId, path.blockId, key, value);
    } else {
      store.updateSectionSetting(path.sectionId, key, value);
    }
  };

  const handleDelete = () => {
    if (confirm(`Delete "${displayName}"?`)) {
      if (type === "block" && path.blockId) {
        store.deleteBlock(path.sectionId, path.blockId);
      } else {
        store.deleteSection(path.groupType, path.sectionId);
      }
    }
  };

  const handleDuplicate = () => {
    if (type === "section") {
      store.duplicateSection(path.groupType, path.sectionId);
    }
  };

  const handleBackToSection = () => {
    store.selectSection(path.groupType, path.sectionId);
  };

  return (
    <div className="editor-sidebar-secondary__container">
      {/* Breadcrumb Navigation */}
      {type === "block" && (
        <nav className="editor-breadcrumb">
          <button
            className="editor-breadcrumb__item editor-breadcrumb__item--link"
            onClick={handleBackToSection}
          >
            {sectionName}
          </button>
          <ChevronDownIcon className="editor-breadcrumb__separator" style={{ transform: "rotate(-90deg)" }} />
          <span className="editor-breadcrumb__item editor-breadcrumb__item--current">
            {displayName}
          </span>
        </nav>
      )}

      {/* Header */}
      <header className="editor-sidebar-secondary__header">
        <h2 className="editor-sidebar-secondary__title">{displayName}</h2>
        <div className="editor-header-actions">
          {type === "section" && (
            <button
              className="editor-navitem__action-btn"
              onClick={handleDuplicate}
              title="Duplicate section"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
            </button>
          )}
          <button className="editor-navitem__action-btn" title="More options">
            <Bars2Icon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Settings Content */}
      <div className="editor-sidebar-secondary__content editor-scrollbar">
        {Object.entries(data.settings || {}).length > 0 ? (
          Object.entries(data.settings).map(([key, value]) => (
            <SettingField
              key={key}
              settingKey={key}
              value={value}
              onChange={(newValue) => handleSettingChange(key, newValue)}
            />
          ))
        ) : (
          <p className="editor-empty-text">No settings available.</p>
        )}
      </div>

      {/* Footer */}
      <footer className="editor-sidebar-secondary__footer">
        <button className="editor-remove-btn" onClick={handleDelete}>
          <TrashIcon className="w-4 h-4" />
          <span>Remove {type}</span>
        </button>
      </footer>
    </div>
  );
};

// ============================================
// SETTING FIELD
// ============================================

interface SettingFieldProps {
  settingKey: string;
  value: any;
  onChange: (value: any) => void;
}

const SettingField = ({ settingKey, value, onChange }: SettingFieldProps) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [resourcePickerType, setResourcePickerType] = useState<"products" | "collections" | "pages" | "files">("files");

  const label = settingKey
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // Detect field types by key name
  const isColorField =
    settingKey.toLowerCase().includes("color") ||
    settingKey.toLowerCase().includes("background") ||
    (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value));

  const isImageField =
    settingKey.toLowerCase().includes("image") ||
    settingKey.toLowerCase().includes("logo") ||
    settingKey.toLowerCase().includes("cover") ||
    settingKey.toLowerCase().includes("banner") ||
    settingKey.toLowerCase().includes("photo");

  const isProductField =
    settingKey.toLowerCase().includes("product") &&
    !settingKey.toLowerCase().includes("products");

  const isCollectionField =
    settingKey.toLowerCase().includes("collection") &&
    !settingKey.toLowerCase().includes("collections");

  const isProductsField = settingKey.toLowerCase().includes("products");
  const isCollectionsField = settingKey.toLowerCase().includes("collections");

  // Product Picker
  if (isProductField) {
    const productData = typeof value === "object" && value ? value : null;

    return (
      <div className="editor-setting">
        <label className="editor-setting__label">{label}</label>
        <div className="editor-resource-picker">
          <button
            className="editor-resource-picker__trigger"
            onClick={() => {
              setResourcePickerType("products");
              setShowResourcePicker(true);
            }}
          >
            {productData?.image ? (
              <img
                src={productData.image}
                alt={productData.title}
                className="editor-resource-picker__preview"
              />
            ) : (
              <div className="editor-resource-picker__placeholder">
                <ShoppingBagIcon className="editor-resource-picker__placeholder-icon" />
              </div>
            )}
            <div className="editor-resource-picker__info">
              {productData?.title ? (
                <>
                  <span className="editor-resource-picker__title">{productData.title}</span>
                  {productData.price && (
                    <span className="editor-resource-picker__meta">{productData.price}</span>
                  )}
                </>
              ) : (
                <span className="editor-resource-picker__empty">Select a product</span>
              )}
            </div>
            {productData && (
              <button
                className="editor-resource-picker__remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </button>
        </div>
        <ResourcePickerModal
          isOpen={showResourcePicker && resourcePickerType === "products"}
          onClose={() => setShowResourcePicker(false)}
          onSelect={(resource) => {
            onChange({
              id: resource.id,
              title: resource.title,
              handle: resource.handle,
              price: resource.price,
              image: resource.image,
            });
          }}
          resourceType="products"
          selectedId={productData?.id}
        />
      </div>
    );
  }

  // Collection Picker
  if (isCollectionField) {
    const collectionData = typeof value === "object" && value ? value : null;

    return (
      <div className="editor-setting">
        <label className="editor-setting__label">{label}</label>
        <div className="editor-resource-picker">
          <button
            className="editor-resource-picker__trigger"
            onClick={() => {
              setResourcePickerType("collections");
              setShowResourcePicker(true);
            }}
          >
            {collectionData?.image ? (
              <img
                src={collectionData.image}
                alt={collectionData.title}
                className="editor-resource-picker__preview"
              />
            ) : (
              <div className="editor-resource-picker__placeholder">
                <Square3Stack3DIcon className="editor-resource-picker__placeholder-icon" />
              </div>
            )}
            <div className="editor-resource-picker__info">
              {collectionData?.title ? (
                <>
                  <span className="editor-resource-picker__title">{collectionData.title}</span>
                  {collectionData.meta && (
                    <span className="editor-resource-picker__meta">{collectionData.meta}</span>
                  )}
                </>
              ) : (
                <span className="editor-resource-picker__empty">Select a collection</span>
              )}
            </div>
            {collectionData && (
              <button
                className="editor-resource-picker__remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </button>
        </div>
        <ResourcePickerModal
          isOpen={showResourcePicker && resourcePickerType === "collections"}
          onClose={() => setShowResourcePicker(false)}
          onSelect={(resource) => {
            onChange({
              id: resource.id,
              title: resource.title,
              handle: resource.handle,
              meta: resource.meta,
              image: resource.image,
            });
          }}
          resourceType="collections"
          selectedId={collectionData?.id}
        />
      </div>
    );
  }

  // Image picker with modal
  if (isImageField) {
    const hasImage = typeof value === "string" && value.length > 0;
    const filename = hasImage ? value.split("/").pop() : null;

    return (
      <div className="editor-setting">
        <label className="editor-setting__label">{label}</label>
        <div className="editor-image-picker">
          <button
            className={clsx(
              "editor-image-picker__trigger",
              hasImage && "editor-image-picker__trigger--has-image"
            )}
            onClick={() => {
              setResourcePickerType("files");
              setShowResourcePicker(true);
            }}
          >
            {hasImage ? (
              <img
                src={value}
                alt={label}
                className="editor-image-picker__preview"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="editor-image-picker__placeholder">
                <PhotoIcon className="editor-image-picker__placeholder-icon" />
              </div>
            )}
            <div className="editor-image-picker__info">
              {hasImage ? (
                <span className="editor-image-picker__filename">{filename}</span>
              ) : (
                <>
                  <span className="editor-image-picker__label">Select image</span>
                  <span className="editor-image-picker__hint">from Shopify files</span>
                </>
              )}
            </div>
            {hasImage && (
              <div className="editor-image-picker__actions">
                <button
                  className="editor-image-picker__btn editor-image-picker__btn--remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  title="Remove image"
                >
                  <TrashIcon className="editor-image-picker__btn-icon" />
                </button>
              </div>
            )}
          </button>
        </div>
        <ResourcePickerModal
          isOpen={showResourcePicker && resourcePickerType === "files"}
          onClose={() => setShowResourcePicker(false)}
          onSelect={(resource) => {
            onChange(resource.url || resource.image || "");
          }}
          resourceType="files"
          title="Image"
        />
      </div>
    );
  }

  // Color picker
  if (isColorField && typeof value === "string") {
    return (
      <div className="editor-setting">
        <label className="editor-setting__label">{label}</label>
        <div className="editor-color-picker">
          <button
            className="editor-color-picker__trigger"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <span
              className="editor-color-picker__swatch"
              style={{ backgroundColor: value || "#ffffff" }}
            />
            <span className="editor-color-picker__value">{value || "Select color"}</span>
          </button>

          {showColorPicker && (
            <div className="editor-color-picker__popover">
              <div
                className="editor-color-picker__overlay"
                onClick={() => setShowColorPicker(false)}
              />
              <div className="editor-color-picker__panel">
                <div className="editor-color-picker__presets">
                  {[
                    "#000000", "#ffffff", "#1a1a1a", "#303030",
                    "#2c6ecb", "#007f5f", "#e67e22", "#e74c3c",
                    "#9b59b6", "#f39c12", "#16a085", "#3498db",
                    "#e91e63", "#673ab7", "#00bcd4", "#8bc34a",
                  ].map((presetColor) => (
                    <button
                      key={presetColor}
                      className={clsx(
                        "editor-color-picker__preset",
                        value === presetColor && "editor-color-picker__preset--active"
                      )}
                      style={{ backgroundColor: presetColor }}
                      onClick={() => {
                        onChange(presetColor);
                        setShowColorPicker(false);
                      }}
                    />
                  ))}
                </div>
                <div className="editor-color-picker__custom">
                  <input
                    type="color"
                    value={value || "#ffffff"}
                    onChange={(e) => onChange(e.target.value)}
                    className="editor-color-picker__input"
                  />
                  <input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#000000"
                    className="editor-setting__input"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Boolean
  if (typeof value === "boolean") {
    return (
      <div className="editor-setting">
        <div className="editor-setting__row">
          <label className="editor-setting__label">{label}</label>
          <button
            className={clsx("editor-switch", value && "editor-switch--checked")}
            onClick={() => onChange(!value)}
          >
            <span className="editor-switch__thumb" />
          </button>
        </div>
      </div>
    );
  }

  // Number
  if (typeof value === "number") {
    return (
      <div className="editor-setting">
        <label className="editor-setting__label">{label}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className="editor-setting__input"
        />
      </div>
    );
  }

  // Array (select)
  if (Array.isArray(value)) {
    return (
      <div className="editor-setting">
        <label className="editor-setting__label">{label}</label>
        <select
          value={value[0] || ""}
          onChange={(e) => onChange([e.target.value])}
          className="editor-setting__select"
        >
          {value.map((option: string, index: number) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Default: text input
  return (
    <div className="editor-setting">
      <label className="editor-setting__label">{label}</label>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="editor-setting__input"
      />
    </div>
  );
};

// ============================================
// MAIN EDITOR COMPONENT
// ============================================

export default function Editor() {
  const { initialData, shop, themeId, previewUrl, currentTemplate, availableTemplates } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const store = useEditorStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [sectionPickerGroup, setSectionPickerGroup] = useState<GroupType>("template");
  const [sidebarSearch, setSidebarSearch] = useState("");

  // Get current template label
  const currentTemplateLabel = availableTemplates?.find((t: { value: string; label: string }) => t.value === currentTemplate)?.label || "Home page";

  // Handle template change
  const handleTemplateChange = (templateValue: string) => {
    setShowTemplateDropdown(false);
    navigate(`/app/editor?template=${templateValue}`);
  };

  // Handle discard all changes
  const handleDiscardChanges = () => {
    if (confirm("Are you sure you want to discard all unsaved changes? This cannot be undone.")) {
      store.initializeFromServer(
        initialData.template,
        initialData.header,
        initialData.footer
      );
      store.markClean();
    }
  };

  // Handle add section click
  const handleAddSectionClick = (groupType: GroupType) => {
    setSectionPickerGroup(groupType);
    setShowSectionPicker(true);
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Initialize store
  useEffect(() => {
    store.initializeFromServer(
      initialData.template,
      initialData.header,
      initialData.footer
    );
    store.setPreviewUrl(previewUrl);
  }, []);

  // Listen for iframe ready message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "vsbuilder:ready") {
        setIframeReady(true);
        // Send initial state
        sendPreviewUpdate();
      }
      if (event.data?.type === "vsbuilder:section-click") {
        const { sectionId, groupType } = event.data;
        if (sectionId && groupType) {
          store.selectSection(groupType, sectionId);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send preview updates when store changes
  const sendPreviewUpdate = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;

    const data = {
      type: "vsbuilder:update",
      payload: {
        template: store.template,
        headerGroup: store.headerGroup,
        footerGroup: store.footerGroup,
        selectedPath: store.selectedPath,
      },
    };

    iframeRef.current.contentWindow.postMessage(data, "*");
  }, [store.template, store.headerGroup, store.footerGroup, store.selectedPath]);

  // Subscribe to store changes and send updates to preview
  useEffect(() => {
    // Debounced update to avoid flooding iframe
    let timeout: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (iframeReady) {
          sendPreviewUpdate();
        }
      }, 100);
    };

    // Manual subscription to zustand store
    const unsubscribe = useEditorStore.subscribe(
      (state) => ({
        template: state.template,
        headerGroup: state.headerGroup,
        footerGroup: state.footerGroup,
        selectedPath: state.selectedPath,
      }),
      debouncedUpdate,
      { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
    );

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [iframeReady, sendPreviewUpdate]);

  // Track save status
  useEffect(() => {
    if (fetcher.state === "submitting") {
      store.setSaving(true);
    } else if (fetcher.state === "idle" && fetcher.data) {
      store.setSaving(false);
      if ((fetcher.data as any).success) {
        store.markClean();
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Unsaved changes warning (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (store.isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [store.isDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd + Z = Undo, Ctrl/Cmd + Shift + Z = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      }

      // Ctrl/Cmd + S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }

      // Ctrl/Cmd + D = Duplicate selected section
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        const path = store.selectedPath;
        if (path && !path.blockId) {
          store.duplicateSection(path.groupType, path.sectionId);
        }
      }

      // Delete/Backspace = Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        const path = store.selectedPath;
        if (path) {
          e.preventDefault();
          if (path.blockId) {
            store.deleteBlock(path.sectionId, path.blockId);
          } else {
            store.deleteSection(path.groupType, path.sectionId);
          }
        }
      }

      // Escape = Clear selection
      if (e.key === "Escape") {
        store.clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    // Find which group this belongs to
    const findGroup = (id: string): GroupType | null => {
      if (store.template.order.includes(id)) return "template";
      if (store.headerGroup.order.includes(id)) return "header";
      if (store.footerGroup.order.includes(id)) return "footer";
      return null;
    };

    const activeGroup = findGroup(active.id as string);
    const overGroup = findGroup(over.id as string);

    if (!activeGroup || !overGroup) return;

    // For now, only support within-group reordering
    if (activeGroup === overGroup) {
      const groupKey =
        activeGroup === "header"
          ? "headerGroup"
          : activeGroup === "footer"
          ? "footerGroup"
          : "template";

      const order = store[groupKey].order;
      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        store.pushHistory(`Reorder section`);
        store.moveSection(activeGroup, oldIndex, newIndex);
      }
    }
  };

  // Save Handler
  const handleSave = useCallback(() => {
    if (!themeId) return;

    const state = store.getSerializableState();

    const formData = new FormData();
    formData.append("_action", "SAVE_ALL");
    formData.append("themeId", themeId);
    formData.append("template", JSON.stringify(state.template));
    formData.append("header", JSON.stringify(state.headerGroup));
    formData.append("footer", JSON.stringify(state.footerGroup));

    fetcher.submit(formData, { method: "POST", action: "/api/editor" });
  }, [themeId, fetcher]);

  const handleExit = () => {
    if (store.isDirty) {
      if (!confirm("You have unsaved changes. Are you sure you want to exit?")) {
        return;
      }
    }
    navigate("/app");
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="editor-frame editor-theme-light">
        {/* ===== TOP BAR ===== */}
        <nav className="editor-topbar">
          {/* Left: Exit + Theme Name */}
          <div className="editor-topbar__group">
            <button onClick={handleExit} className="editor-topbar__exit-btn">
              <ArrowTopRightOnSquareIcon
                className="editor-topbar__exit-icon"
                style={{ transform: "rotate(180deg)" }}
              />
              <span className="editor-topbar__title">Exit</span>
            </button>

            <span className="editor-topbar__divider" />

            <span className="editor-topbar__title">{shop.split(".")[0]} Theme</span>

            <span className="editor-topbar__badge">
              <span className="editor-topbar__badge-dot" />
              Live
            </span>

            {store.isDirty && (
              <span className="editor-topbar__unsaved">Unsaved changes</span>
            )}
          </div>

          {/* Center: Device Toggle + Undo/Redo */}
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

            <div className="editor-topbar__undo-redo">
              <button
                className="editor-topbar__undo-btn"
                onClick={() => store.undo()}
                disabled={!store.canUndo()}
                title="Undo (Ctrl+Z)"
              >
                <ArrowUturnLeftIcon className="w-4 h-4" />
              </button>
              <button
                className="editor-topbar__undo-btn"
                onClick={() => store.redo()}
                disabled={!store.canRedo()}
                title="Redo (Ctrl+Shift+Z)"
              >
                <ArrowUturnRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Save */}
          <div className="editor-topbar__group">
            <button
              className="editor-topbar__save-btn"
              onClick={handleSave}
              disabled={store.isSaving || !store.isDirty}
            >
              {store.isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </nav>

        {/* ===== BODY ===== */}
        <div className="editor-body">
          {/* ACTION BAR */}
          <aside className="editor-actionbar">
            <ul className="editor-actionbar__list">
              <li>
                <button
                  className={clsx(
                    "editor-actionbar__btn",
                    store.activePanel === "sections" && "editor-actionbar__btn--active"
                  )}
                  onClick={() => store.setActivePanel("sections")}
                  title="Sections"
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </button>
              </li>
              <li>
                <button
                  className={clsx(
                    "editor-actionbar__btn",
                    store.activePanel === "settings" && "editor-actionbar__btn--active"
                  )}
                  onClick={() => store.setActivePanel("settings")}
                  title="Theme settings"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                </button>
              </li>
            </ul>
          </aside>

          {/* SIDEBAR */}
          <aside className="editor-sidebar">
            <header className="editor-sidebar__header">
              <div className="editor-template-selector">
                <button
                  className="editor-template-selector__trigger"
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                >
                  <span className="editor-template-selector__label">{currentTemplateLabel}</span>
                  <ChevronDownIcon className="editor-template-selector__icon" />
                </button>
                {showTemplateDropdown && (
                  <div className="editor-template-selector__dropdown">
                    <div className="editor-template-selector__overlay" onClick={() => setShowTemplateDropdown(false)} />
                    <ul className="editor-template-selector__list">
                      {availableTemplates?.map((template: { value: string; label: string; path: string }) => (
                        <li key={template.value}>
                          <button
                            className={clsx(
                              "editor-template-selector__item",
                              currentTemplate === template.value && "editor-template-selector__item--active"
                            )}
                            onClick={() => handleTemplateChange(template.value)}
                          >
                            {template.label}
                            {currentTemplate === template.value && (
                              <CheckIcon className="w-4 h-4" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </header>

            {/* Sidebar Search */}
            <div className="editor-sidebar-search">
              <div className="editor-sidebar-search__input-wrapper">
                <MagnifyingGlassIcon className="editor-sidebar-search__icon" />
                <input
                  type="text"
                  className="editor-sidebar-search__input"
                  placeholder="Search sections..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="editor-sidebar__content editor-scrollbar">
              <SectionGroup
                groupType="header"
                label="Header"
                sections={store.headerGroup.sections}
                order={store.headerGroup.order}
                searchFilter={sidebarSearch}
              />
              <SectionGroup
                groupType="template"
                label="Template"
                sections={store.template.sections}
                order={store.template.order}
                searchFilter={sidebarSearch}
              />
              <SectionGroup
                groupType="footer"
                label="Footer"
                sections={store.footerGroup.sections}
                order={store.footerGroup.order}
                searchFilter={sidebarSearch}
              />
            </div>
          </aside>

          {/* MAIN PREVIEW */}
          <main className="editor-main">
            <div className="editor-preview">
              {/* Browser Controls */}
              <div className="editor-browser-controls">
                <div className="editor-browser-controls__nav">
                  <button
                    className="editor-browser-controls__btn"
                    onClick={() => iframeRef.current?.contentWindow?.history.back()}
                    title="Go back"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                  </button>
                  <button
                    className="editor-browser-controls__btn"
                    onClick={() => iframeRef.current?.contentWindow?.history.forward()}
                    title="Go forward"
                  >
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                  <button
                    className="editor-browser-controls__btn"
                    onClick={() => iframeRef.current?.contentWindow?.location.reload()}
                    title="Refresh preview"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="editor-browser-controls__url">
                  <GlobeAltIcon className="w-4 h-4" />
                  <span className="editor-browser-controls__url-text">
                    {store.previewUrl?.replace(/^https?:\/\//, '').split('?')[0] || 'Loading...'}
                  </span>
                </div>
                <div className="editor-browser-controls__actions">
                  <a
                    href={store.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="editor-browser-controls__btn"
                    title="Open in new tab"
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Preview Frame */}
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={clsx(
                  "editor-preview__frame",
                  store.device === "mobile" && "editor-preview__frame--mobile"
                )}
              >
                <iframe
                  ref={iframeRef}
                  src={store.previewUrl}
                  className="editor-preview__iframe"
                  title="Store preview"
                  onLoad={() => {
                    // Fallback if iframe doesn't send ready message
                    setTimeout(() => setIframeReady(true), 1000);
                  }}
                />
              </motion.div>
            </div>
          </main>

          {/* INSPECTOR */}
          <aside className="editor-sidebar-secondary">
            <AnimatePresence mode="wait">
              <motion.div
                key={store.selectedPath?.sectionId || "empty"}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="editor-sidebar-secondary__animation-wrapper"
              >
                <SettingsInspector />
              </motion.div>
            </AnimatePresence>
          </aside>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDragId && (
            <div className="editor-navitem editor-navitem--dragging bg-white shadow-xl opacity-90 rounded-lg border border-blue-400">
              <div className="editor-navitem__icon">
                <Square3Stack3DIcon className="w-4 h-4" />
              </div>
              <span className="editor-navitem__title">Moving...</span>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
