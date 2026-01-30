/**
 * 🎨 ULTRA CANVAS ENGINE - Visual Theme Renderer
 * Smart section rendering with click overlays and drag-drop
 * Renders downloaded theme data as interactive visual blocks
 */
import {
    Bars3Icon,
    ChatBubbleLeftRightIcon,
    CodeBracketIcon,
    CubeIcon,
    DocumentTextIcon,
    EnvelopeIcon,
    GlobeAltIcon,
    MapIcon,
    NewspaperIcon,
    PhotoIcon,
    PlayCircleIcon,
    RectangleGroupIcon,
    ShoppingBagIcon,
    SparklesIcon,
    Square2StackIcon,
    Square3Stack3DIcon,
    Squares2X2Icon,
    TagIcon,
    VideoCameraIcon
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { GroupType, Section } from "../store/useEditorStore";
import { useEditorStore } from "../store/useEditorStore";

// ============================================
// SECTION TYPE CONFIGURATIONS
// ============================================

interface SectionConfig {
  icon: React.ElementType;
  label: string;
  color: string; // Gradient colors
  bgPattern?: "dots" | "grid" | "lines" | "diagonal";
  height: "sm" | "md" | "lg" | "xl" | "auto";
  description?: string;
}

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  // Hero & Banner Sections
  "image-banner": {
    icon: PhotoIcon,
    label: "Image Banner",
    color: "from-purple-500 to-pink-500",
    height: "xl",
    description: "Full-width banner with overlay text",
  },
  "image-with-text": {
    icon: RectangleGroupIcon,
    label: "Image with Text",
    color: "from-blue-500 to-cyan-500",
    height: "lg",
    description: "Image alongside text content",
  },
  "slideshow": {
    icon: Square2StackIcon,
    label: "Slideshow",
    color: "from-orange-500 to-amber-500",
    height: "xl",
    description: "Rotating image carousel",
  },
  "video": {
    icon: VideoCameraIcon,
    label: "Video",
    color: "from-red-500 to-rose-500",
    height: "xl",
    description: "Video player section",
  },
  "video-hero": {
    icon: PlayCircleIcon,
    label: "Video Hero",
    color: "from-red-600 to-pink-500",
    height: "xl",
    description: "Full-screen video background",
  },

  // Product & Collection Sections
  "featured-collection": {
    icon: Square3Stack3DIcon,
    label: "Featured Collection",
    color: "from-green-500 to-emerald-500",
    height: "lg",
    description: "Showcase products from a collection",
  },
  "featured-product": {
    icon: ShoppingBagIcon,
    label: "Featured Product",
    color: "from-indigo-500 to-violet-500",
    height: "lg",
    description: "Highlight a single product",
  },
  "collection-list": {
    icon: Squares2X2Icon,
    label: "Collection List",
    color: "from-teal-500 to-cyan-500",
    height: "lg",
    description: "Grid of collection cards",
  },
  "product-grid": {
    icon: Square3Stack3DIcon,
    label: "Product Grid",
    color: "from-lime-500 to-green-500",
    height: "lg",
    description: "Grid of product cards",
  },

  // Content Sections
  "rich-text": {
    icon: DocumentTextIcon,
    label: "Rich Text",
    color: "from-slate-500 to-gray-600",
    height: "md",
    description: "Formatted text content",
  },
  "multicolumn": {
    icon: Squares2X2Icon,
    label: "Multi-column",
    color: "from-sky-500 to-blue-500",
    height: "md",
    description: "Content in multiple columns",
  },
  "collapsible-content": {
    icon: Bars3Icon,
    label: "Collapsible Content",
    color: "from-zinc-500 to-neutral-600",
    height: "md",
    description: "Accordion-style content",
  },

  // Social & Trust Sections
  "testimonials": {
    icon: ChatBubbleLeftRightIcon,
    label: "Testimonials",
    color: "from-yellow-500 to-orange-500",
    height: "md",
    description: "Customer reviews and quotes",
  },
  "logo-list": {
    icon: SparklesIcon,
    label: "Logo List",
    color: "from-gray-500 to-slate-600",
    height: "sm",
    description: "Partner or brand logos",
  },

  // Navigation & Footer
  "header": {
    icon: Bars3Icon,
    label: "Header",
    color: "from-slate-700 to-gray-800",
    height: "sm",
    description: "Site navigation header",
  },
  "announcement-bar": {
    icon: TagIcon,
    label: "Announcement Bar",
    color: "from-amber-500 to-yellow-500",
    height: "sm",
    description: "Top banner for announcements",
  },
  "footer": {
    icon: Squares2X2Icon,
    label: "Footer",
    color: "from-gray-700 to-slate-800",
    height: "lg",
    description: "Site footer with links",
  },

  // Special Sections
  "newsletter": {
    icon: EnvelopeIcon,
    label: "Newsletter",
    color: "from-pink-500 to-rose-500",
    height: "md",
    description: "Email subscription form",
  },
  "contact-form": {
    icon: EnvelopeIcon,
    label: "Contact Form",
    color: "from-cyan-500 to-blue-500",
    height: "md",
    description: "Contact form section",
  },
  "map": {
    icon: MapIcon,
    label: "Map",
    color: "from-green-600 to-teal-500",
    height: "lg",
    description: "Location map",
  },
  "blog-posts": {
    icon: NewspaperIcon,
    label: "Blog Posts",
    color: "from-violet-500 to-purple-500",
    height: "lg",
    description: "Recent blog articles",
  },
  "custom-liquid": {
    icon: CodeBracketIcon,
    label: "Custom Liquid",
    color: "from-gray-600 to-zinc-700",
    height: "md",
    description: "Custom Liquid code",
  },
  "custom-html": {
    icon: CodeBracketIcon,
    label: "Custom HTML",
    color: "from-orange-600 to-red-500",
    height: "md",
    description: "Custom HTML section",
  },

  // Default fallback
  "default": {
    icon: CubeIcon,
    label: "Section",
    color: "from-gray-500 to-gray-600",
    height: "md",
    description: "Custom section",
  },
};

// Height mappings
const HEIGHT_CLASSES: Record<string, string> = {
  sm: "min-h-[60px]",
  md: "min-h-[120px]",
  lg: "min-h-[200px]",
  xl: "min-h-[320px]",
  auto: "min-h-[80px]",
};

// ============================================
// GET SECTION CONFIG
// ============================================

function getSectionConfig(sectionType: string): SectionConfig {
  // Direct match
  if (SECTION_CONFIGS[sectionType]) {
    return SECTION_CONFIGS[sectionType];
  }

  // Partial match (handle variations)
  const normalizedType = sectionType.toLowerCase().replace(/[-_]/g, "");

  for (const [key, config] of Object.entries(SECTION_CONFIGS)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (normalizedType.includes(normalizedKey) || normalizedKey.includes(normalizedType)) {
      return config;
    }
  }

  // Return default with the actual type name
  return {
    ...SECTION_CONFIGS.default,
    label: sectionType.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
  };
}

// ============================================
// SECTION BLOCK COMPONENT
// ============================================

interface SectionBlockProps {
  sectionId: string;
  section: Section;
  groupType: GroupType;
  isSelected: boolean;
  index: number;
}

export function SectionBlock({ sectionId, section, groupType, isSelected, index }: SectionBlockProps) {
  const store = useEditorStore();
  const config = getSectionConfig(section.type);
  const Icon = config.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    store.selectSection(groupType, sectionId);
  };

  const blockCount = section.block_order?.length || Object.keys(section.blocks || {}).length;

  // Extract useful settings for preview
  const title = section.settings?.title || section.settings?.heading || section.label || config.label;
  const subtitle = section.settings?.subheading || section.settings?.text || config.description;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className={clsx(
        "section-block relative group cursor-pointer transition-all duration-200",
        HEIGHT_CLASSES[config.height],
        "rounded-lg overflow-hidden",
        section.disabled && "opacity-50",
        isSelected
          ? "ring-2 ring-blue-500 ring-offset-2"
          : "hover:ring-2 hover:ring-blue-300 hover:ring-offset-1"
      )}
    >
      {/* Background Gradient */}
      <div className={clsx(
        "absolute inset-0 bg-gradient-to-br",
        config.color,
        "opacity-90"
      )} />

      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-10 bg-pattern-grid" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-4 text-white text-center">
        <Icon className="w-10 h-10 mb-2 opacity-80" />
        <h3 className="font-semibold text-lg drop-shadow-sm">{title}</h3>
        {subtitle && (
          <p className="text-sm opacity-75 mt-1 max-w-md line-clamp-2">{subtitle}</p>
        )}
        {blockCount > 0 && (
          <div className="mt-2 px-2 py-1 bg-white/20 rounded-full text-xs">
            {blockCount} {blockCount === 1 ? "block" : "blocks"}
          </div>
        )}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg">
          Selected
        </div>
      )}

      {/* Hover Overlay */}
      <div className={clsx(
        "absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors",
        "flex items-center justify-center opacity-0 group-hover:opacity-100"
      )}>
        <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          Click to edit
        </span>
      </div>

      {/* Disabled Overlay */}
      {section.disabled && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
          <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
            Hidden
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// SECTION GROUP COMPONENT
// ============================================

interface CanvasSectionGroupProps {
  groupType: GroupType;
  label: string;
  sections: Record<string, Section>;
  order: string[];
  color: string;
}

export function CanvasSectionGroup({ groupType, label, sections, order, color }: CanvasSectionGroupProps) {
  const store = useEditorStore();

  if (order.length === 0) {
    return null;
  }

  return (
    <div className="canvas-section-group mb-4">
      {/* Group Label */}
      <div className={clsx(
        "flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm font-medium text-white",
        `bg-gradient-to-r ${color}`
      )}>
        <span className="opacity-75 text-xs uppercase tracking-wider">{label}</span>
        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
          {order.length}
        </span>
      </div>

      {/* Sections */}
      <div className="space-y-2 p-2 bg-gray-100 rounded-b-lg">
        {order.map((sectionId, index) => {
          const section = sections[sectionId];
          if (!section) return null;

          return (
            <SectionBlock
              key={sectionId}
              sectionId={sectionId}
              section={section}
              groupType={groupType}
              isSelected={store.selectedPath?.sectionId === sectionId}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MAIN CANVAS COMPONENT
// ============================================

export function VisualCanvas() {
  const store = useEditorStore();

  const {
    headerGroup,
    template,
    footerGroup,
  } = store;

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only clear selection if clicking directly on canvas background
    if (e.target === e.currentTarget) {
      store.clearSelection();
    }
  };

  return (
    <div
      className="visual-canvas h-full overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100 p-4"
      onClick={handleCanvasClick}
    >
      <div className="max-w-4xl mx-auto">
        {/* Device Frame */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
          {/* Browser Chrome */}
          <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 ml-4">
              <div className="bg-white rounded-md px-4 py-1.5 text-sm text-gray-500 flex items-center gap-2 border border-gray-200">
                <GlobeAltIcon className="w-4 h-4" />
                <span className="truncate">{store.previewUrl || "your-store.myshopify.com"}</span>
              </div>
            </div>
          </div>

          {/* Canvas Content */}
          <div className="canvas-content min-h-[600px]">
            {/* Header Group */}
            {headerGroup.order.length > 0 && (
              <CanvasSectionGroup
                groupType="header"
                label="Header"
                sections={headerGroup.sections}
                order={headerGroup.order}
                color="from-slate-600 to-slate-700"
              />
            )}

            {/* Main Template */}
            {template.order.length > 0 ? (
              <CanvasSectionGroup
                groupType="template"
                label="Page Content"
                sections={template.sections}
                order={template.order}
                color="from-blue-500 to-indigo-500"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Square3Stack3DIcon className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-gray-500">No sections yet</h3>
                <p className="text-sm">Add sections from the left panel</p>
              </div>
            )}

            {/* Footer Group */}
            {footerGroup.order.length > 0 && (
              <CanvasSectionGroup
                groupType="footer"
                label="Footer"
                sections={footerGroup.sections}
                order={footerGroup.order}
                color="from-gray-600 to-gray-700"
              />
            )}
          </div>
        </div>

        {/* Canvas Info */}
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>
            Total sections: {" "}
            <span className="font-semibold">
              {headerGroup.order.length + template.order.length + footerGroup.order.length}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default VisualCanvas;
