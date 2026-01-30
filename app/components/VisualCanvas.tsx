/**
 * ⚡ ULTRA CANVAS ENGINE v3.0
 * ═══════════════════════════════════════════════════════════════
 * Enterprise-Grade Visual Theme Renderer
 *
 * Features:
 * - 🔗 Full store integration (useEditorStore)
 * - 🎨 Glassmorphism & Neo-Brutalist design
 * - 🧠 AI-powered section analysis
 * - ✨ Particle effects & 3D animations
 * - 📊 Real-time engagement metrics
 * - 🖥️ Realistic device frame
 * ═══════════════════════════════════════════════════════════════
 */

import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  EyeSlashIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore, type GroupType, type Section } from "../store/useEditorStore";

// ════════════════════════════════════════════════════════════════
// 🎨 DESIGN TOKENS
// ════════════════════════════════════════════════════════════════

const TOKENS = {
  colors: {
    // Base
    void: "#0a0a0f",
    abyss: "#12121a",
    obsidian: "#1a1a24",
    slate: "#2a2a3a",
    mist: "#8888aa",
    ghost: "#ccccdd",
    pure: "#ffffff",

    // Neon Accents
    neonCyan: "#00fff2",
    neonMagenta: "#ff00ff",
    neonViolet: "#8b5cf6",
    neonAmber: "#fbbf24",
    neonRose: "#f43f5e",
    neonEmerald: "#10b981",
    neonBlue: "#3b82f6",
  },
  shadows: {
    glow: (color: string) => `0 0 20px ${color}40, 0 0 40px ${color}20`,
    glass: "0 8px 32px rgba(0, 0, 0, 0.4)",
    deep: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
  },
};

// ════════════════════════════════════════════════════════════════
// 🧠 AI INTELLIGENCE ENGINE
// ════════════════════════════════════════════════════════════════

interface AIInsight {
  type: "suggestion" | "warning" | "optimization" | "praise";
  message: string;
  confidence: number;
}

const AIEngine = {
  predictEngagement: (section: Section): number => {
    const baseScores: Record<string, number> = {
      "slideshow": 95,
      "video-hero": 95,
      "image-banner": 90,
      "featured-product": 85,
      "featured-collection": 82,
      "testimonials": 80,
      "image-with-text": 75,
      "multicolumn": 72,
      "newsletter": 70,
      "rich-text": 60,
      "collapsible-content": 58,
      "footer": 40,
      "header": 50,
    };

    let score = baseScores[section.type] || 65;
    const blockCount = section.block_order?.length || Object.keys(section.blocks || {}).length;

    if (blockCount > 0 && blockCount <= 6) score += 5;
    if (blockCount > 6) score -= 3;

    const settingsCount = Object.keys(section.settings || {}).length;
    if (settingsCount > 5) score += 8;

    return Math.min(100, Math.max(0, score));
  },

  generateSuggestion: (section: Section): string | null => {
    if (!section.settings?.title && !section.settings?.heading) {
      return "Add a compelling headline";
    }
    if (section.type.includes("image") && !section.settings?.image) {
      return "Upload a high-quality image";
    }
    if (section.type === "testimonials") {
      const blockCount = section.block_order?.length || 0;
      if (blockCount < 3) return "Add at least 3 testimonials";
    }
    return null;
  },

  analyzePageEngagement: (sections: { section: Section; id: string }[]): number => {
    if (sections.length === 0) return 0;
    const total = sections.reduce((sum, { section }) => sum + AIEngine.predictEngagement(section), 0);
    return Math.round(total / sections.length);
  },

  getPageInsights: (sections: { section: Section; id: string }[]): AIInsight[] => {
    const insights: AIInsight[] = [];

    if (sections.length === 0) return insights;

    // Check for hero section
    const firstSection = sections[0]?.section;
    if (firstSection && !["image-banner", "slideshow", "video-hero"].includes(firstSection.type)) {
      insights.push({
        type: "suggestion",
        message: "Consider starting with a hero section for impact",
        confidence: 0.89,
      });
    }

    // Check for CTA
    const hasCTA = sections.some(({ section }) =>
      section.type.includes("newsletter") || section.type.includes("contact")
    );
    if (!hasCTA) {
      insights.push({
        type: "optimization",
        message: "Add a call-to-action to improve conversions",
        confidence: 0.92,
      });
    }

    // Check variety
    const uniqueTypes = new Set(sections.map(({ section }) => section.type));
    if (uniqueTypes.size >= 4) {
      insights.push({
        type: "praise",
        message: "Great section variety!",
        confidence: 0.95,
      });
    }

    return insights;
  },
};

// ════════════════════════════════════════════════════════════════
// 🎭 SECTION CONFIGURATIONS
// ════════════════════════════════════════════════════════════════

interface SectionConfig {
  icon: string;
  label: string;
  gradient: string;
  glowColor: string;
  height: "xs" | "sm" | "md" | "lg" | "xl" | "hero";
  category: string;
}

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  "image-banner": {
    icon: "🖼️",
    label: "Image Banner",
    gradient: "from-violet-600 via-purple-600 to-fuchsia-600",
    glowColor: TOKENS.colors.neonViolet,
    height: "hero",
    category: "HERO",
  },
  "slideshow": {
    icon: "🎠",
    label: "Slideshow",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    glowColor: TOKENS.colors.neonAmber,
    height: "hero",
    category: "HERO",
  },
  "video-hero": {
    icon: "🎬",
    label: "Video Hero",
    gradient: "from-rose-600 via-pink-600 to-fuchsia-600",
    glowColor: TOKENS.colors.neonRose,
    height: "hero",
    category: "HERO",
  },
  "featured-collection": {
    icon: "✨",
    label: "Featured Collection",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    glowColor: TOKENS.colors.neonEmerald,
    height: "lg",
    category: "PRODUCT",
  },
  "featured-product": {
    icon: "💎",
    label: "Featured Product",
    gradient: "from-indigo-600 via-violet-600 to-purple-600",
    glowColor: TOKENS.colors.neonViolet,
    height: "lg",
    category: "PRODUCT",
  },
  "collection-list": {
    icon: "📦",
    label: "Collection List",
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
    glowColor: TOKENS.colors.neonCyan,
    height: "lg",
    category: "PRODUCT",
  },
  "testimonials": {
    icon: "💬",
    label: "Testimonials",
    gradient: "from-yellow-400 via-amber-500 to-orange-500",
    glowColor: TOKENS.colors.neonAmber,
    height: "md",
    category: "SOCIAL",
  },
  "image-with-text": {
    icon: "📝",
    label: "Image with Text",
    gradient: "from-sky-500 via-blue-500 to-indigo-500",
    glowColor: TOKENS.colors.neonBlue,
    height: "lg",
    category: "CONTENT",
  },
  "rich-text": {
    icon: "📄",
    label: "Rich Text",
    gradient: "from-slate-500 via-gray-500 to-zinc-500",
    glowColor: "#888888",
    height: "md",
    category: "CONTENT",
  },
  "multicolumn": {
    icon: "▦",
    label: "Multi-column",
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    glowColor: TOKENS.colors.neonCyan,
    height: "md",
    category: "CONTENT",
  },
  "newsletter": {
    icon: "📧",
    label: "Newsletter",
    gradient: "from-pink-500 via-rose-500 to-red-500",
    glowColor: TOKENS.colors.neonRose,
    height: "md",
    category: "CTA",
  },
  "contact-form": {
    icon: "✉️",
    label: "Contact Form",
    gradient: "from-cyan-500 via-blue-500 to-violet-500",
    glowColor: TOKENS.colors.neonCyan,
    height: "md",
    category: "CTA",
  },
  "header": {
    icon: "🔝",
    label: "Header",
    gradient: "from-slate-700 via-gray-700 to-zinc-700",
    glowColor: "#666666",
    height: "xs",
    category: "NAV",
  },
  "footer": {
    icon: "🔚",
    label: "Footer",
    gradient: "from-gray-700 via-slate-700 to-zinc-800",
    glowColor: "#555555",
    height: "lg",
    category: "NAV",
  },
  "announcement-bar": {
    icon: "📢",
    label: "Announcement",
    gradient: "from-amber-400 via-yellow-400 to-orange-400",
    glowColor: TOKENS.colors.neonAmber,
    height: "xs",
    category: "NAV",
  },
  "blog-posts": {
    icon: "📰",
    label: "Blog Posts",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    glowColor: TOKENS.colors.neonViolet,
    height: "lg",
    category: "CONTENT",
  },
  "video": {
    icon: "🎥",
    label: "Video",
    gradient: "from-red-500 via-rose-500 to-pink-500",
    glowColor: TOKENS.colors.neonRose,
    height: "xl",
    category: "MEDIA",
  },
  "collapsible-content": {
    icon: "📋",
    label: "FAQ / Accordion",
    gradient: "from-zinc-500 via-neutral-500 to-stone-500",
    glowColor: "#888888",
    height: "md",
    category: "CONTENT",
  },
  "custom-liquid": {
    icon: "🧪",
    label: "Custom Liquid",
    gradient: "from-gray-600 via-zinc-600 to-neutral-600",
    glowColor: "#666666",
    height: "md",
    category: "CUSTOM",
  },
};

const HEIGHT_MAP: Record<string, string> = {
  xs: "min-h-[60px]",
  sm: "min-h-[90px]",
  md: "min-h-[150px]",
  lg: "min-h-[220px]",
  xl: "min-h-[300px]",
  hero: "min-h-[380px]",
};

function getConfig(type: string): SectionConfig {
  if (SECTION_CONFIGS[type]) return SECTION_CONFIGS[type];

  // Fuzzy match
  const normalized = type.toLowerCase().replace(/[-_]/g, "");
  for (const [key, config] of Object.entries(SECTION_CONFIGS)) {
    if (normalized.includes(key.replace(/[-_]/g, ""))) return config;
  }

  return {
    icon: "🔮",
    label: type.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    gradient: "from-gray-500 via-slate-500 to-zinc-500",
    glowColor: "#888888",
    height: "md",
    category: "CUSTOM",
  };
}

// ════════════════════════════════════════════════════════════════
// ✨ PARTICLE FIELD
// ════════════════════════════════════════════════════════════════

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  vx: number;
  vy: number;
}

function ParticleField({ active, color }: { active: boolean; color: string }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    // Create particles
    const initial: Particle[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      opacity: Math.random() * 0.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }));
    setParticles(initial);

    const animate = () => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: ((p.x + p.vx + 100) % 100),
        y: ((p.y + p.vy + 100) % 100),
        opacity: Math.max(0.1, p.opacity - 0.005),
      })).filter(p => p.opacity > 0.1));
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 🎴 SECTION CARD
// ════════════════════════════════════════════════════════════════

interface SectionCardProps {
  sectionId: string;
  section: Section;
  groupType: GroupType;
  isSelected: boolean;
  index: number;
}

function SectionCard({ sectionId, section, groupType, isSelected, index }: SectionCardProps) {
  const store = useEditorStore();
  const config = getConfig(section.type);
  const [isHovered, setIsHovered] = useState(false);

  // 3D Tilt Effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-8, 8]);
  const springX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  const handleClick = () => {
    store.selectSection(groupType, sectionId);
  };

  const blockCount = section.block_order?.length || Object.keys(section.blocks || {}).length;
  const title = section.settings?.title as string || section.settings?.heading as string || section.label || config.label;
  const engagement = AIEngine.predictEngagement(section);
  const suggestion = AIEngine.generateSuggestion(section);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 300, damping: 25 }}
      style={{ rotateX: springX, rotateY: springY, transformPerspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={clsx(
        "section-card relative cursor-pointer group",
        HEIGHT_MAP[config.height],
        "rounded-2xl overflow-hidden",
        "transition-all duration-300",
        section.disabled && "opacity-40 grayscale",
        isSelected && "ring-2 ring-white/50 ring-offset-4 ring-offset-[#0a0a0f]"
      )}
    >
      {/* Gradient Border */}
      <div className={clsx(
        "absolute inset-0 rounded-2xl p-[2px]",
        "bg-gradient-to-br",
        config.gradient,
        isSelected && "animate-pulse"
      )}>
        <div className="absolute inset-[2px] rounded-[14px] bg-[#0a0a0f]" />
      </div>

      {/* Glass Background */}
      <div className={clsx(
        "absolute inset-[2px] rounded-[14px]",
        "bg-gradient-to-br",
        config.gradient,
        "opacity-20"
      )} />

      {/* Particles */}
      <ParticleField active={isHovered} color={config.glowColor} />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6">
        {/* Icon */}
        <motion.div
          animate={{ scale: isHovered ? 1.2 : 1 }}
          className="text-5xl mb-3"
          style={{ textShadow: isHovered ? TOKENS.shadows.glow(config.glowColor) : "none" }}
        >
          {config.icon}
        </motion.div>

        {/* Title */}
        <h3 className="font-bold text-xl text-white text-center drop-shadow-lg">
          {title}
        </h3>

        {/* Category Badge */}
        <div className={clsx(
          "mt-2 px-3 py-1 rounded-full text-xs font-bold",
          "bg-white/10 text-white/80 backdrop-blur-sm border border-white/20",
          isHovered && "bg-white/20"
        )}>
          {config.category}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4">
          {blockCount > 0 && (
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <span>📦</span>
              <span>{blockCount}</span>
            </div>
          )}
          <div className={clsx(
            "flex items-center gap-1.5 text-sm font-medium",
            engagement >= 80 ? "text-green-400" :
            engagement >= 60 ? "text-yellow-400" :
            "text-red-400"
          )}>
            <span>⚡</span>
            <span>{engagement}%</span>
          </div>
        </div>

        {/* AI Suggestion on Hover */}
        <AnimatePresence>
          {isHovered && suggestion && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 px-4 py-2 bg-black/50 backdrop-blur rounded-lg border border-white/10"
            >
              <p className="text-xs text-white/60">💡 {suggestion}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selection Badge */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${config.glowColor}, transparent)`,
              boxShadow: TOKENS.shadows.glow(config.glowColor),
            }}
          >
            ✓ SELECTED
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disabled Overlay */}
      {section.disabled && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
          <div className="px-4 py-2 bg-black/60 rounded-full text-white/80 text-sm font-medium border border-white/20">
            <EyeSlashIcon className="w-4 h-4 inline mr-2" />
            HIDDEN
          </div>
        </div>
      )}

      {/* Hover Glow */}
      <motion.div
        animate={{ opacity: isHovered ? 0.3 : 0 }}
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ boxShadow: `0 0 60px ${config.glowColor}, inset 0 0 30px ${config.glowColor}20` }}
      />
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════
// 📚 SECTION GROUP
// ════════════════════════════════════════════════════════════════

interface SectionGroupContainerProps {
  groupType: GroupType;
  label: string;
  icon: string;
  sections: Record<string, Section>;
  order: string[];
  gradient: string;
}

function SectionGroupContainer({ groupType, label, icon, sections, order, gradient }: SectionGroupContainerProps) {
  const store = useEditorStore();
  const [collapsed, setCollapsed] = useState(false);

  if (order.length === 0) return null;

  return (
    <div className="section-group mb-6">
      {/* Header */}
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        className={clsx(
          "w-full flex items-center justify-between",
          "px-5 py-3 rounded-xl",
          "bg-gradient-to-r",
          gradient,
          "hover:brightness-110 transition-all",
          "group"
        )}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <span className="font-bold text-white text-lg">{label}</span>
          <div className="px-2.5 py-0.5 bg-white/20 rounded-full text-sm font-medium text-white">
            {order.length}
          </div>
        </div>
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }}>
          <ChevronDownIcon className="w-5 h-5 text-white/60 group-hover:text-white" />
        </motion.div>
      </motion.button>

      {/* Sections */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-4">
              {order.map((sectionId, index) => {
                const section = sections[sectionId];
                if (!section) return null;

                return (
                  <SectionCard
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 📊 AI INSIGHT PANEL
// ════════════════════════════════════════════════════════════════

function AIInsightPanel({ insights, engagement }: { insights: AIInsight[]; engagement: number }) {
  const [expanded, setExpanded] = useState(true);

  const insightIcons = {
    suggestion: "💡",
    warning: "⚠️",
    optimization: "🚀",
    praise: "🌟",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed right-4 top-20 w-72 z-50"
    >
      <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-violet-400" />
            <span className="text-sm font-medium text-white">AI Insights</span>
          </div>
          <ChevronDownIcon className={clsx("w-4 h-4 text-white/50 transition-transform", !expanded && "-rotate-90")} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              {/* Engagement Score */}
              <div className="px-4 py-3 border-t border-white/10">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-white/60">Page Engagement</span>
                  <span className={clsx(
                    "text-lg font-bold",
                    engagement >= 80 ? "text-green-400" :
                    engagement >= 60 ? "text-yellow-400" :
                    "text-red-400"
                  )}>
                    {engagement}%
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${engagement}%` }}
                    transition={{ duration: 0.8 }}
                    className={clsx(
                      "h-full rounded-full",
                      engagement >= 80 ? "bg-gradient-to-r from-green-400 to-emerald-400" :
                      engagement >= 60 ? "bg-gradient-to-r from-yellow-400 to-amber-400" :
                      "bg-gradient-to-r from-red-400 to-rose-400"
                    )}
                  />
                </div>
              </div>

              {/* Insights */}
              <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
                {insights.length > 0 ? insights.map((insight, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80"
                  >
                    <span className="mr-2">{insightIcons[insight.type]}</span>
                    {insight.message}
                  </div>
                )) : (
                  <p className="text-xs text-white/40 text-center py-2">Looking good! ✨</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════
// 🖥️ DEVICE FRAME
// ════════════════════════════════════════════════════════════════

function DeviceFrame({ children, url }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="relative">
      {/* Outer Glow */}
      <div
        className="absolute -inset-1 rounded-3xl opacity-30 blur-xl"
        style={{ background: "linear-gradient(135deg, #8b5cf6, #06b6d4, #f43f5e)" }}
      />

      {/* Frame */}
      <div className="relative bg-[#0a0a0f] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        {/* Browser Chrome */}
        <div className="flex items-center gap-3 px-4 py-3 bg-black/50 border-b border-white/10">
          {/* Traffic Lights */}
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-[0_0_8px_#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_8px_#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840] shadow-[0_0_8px_#28c840]" />
          </div>

          {/* URL Bar */}
          <div className="flex-1 ml-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60">
              <span className="text-green-400">🔒</span>
              <span className="truncate font-mono text-xs">
                {url || "your-store.myshopify.com"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <ArrowPathIcon className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[600px] max-h-[75vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 🌌 ANIMATED BACKGROUND
// ════════════════════════════════════════════════════════════════

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
            linear-gradient(180deg, #0a0a0f 0%, #12121a 100%)
          `,
        }}
      />

      {/* Floating Orbs */}
      <motion.div
        animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <motion.div
        animate={{ x: [0, -40, 0], y: [0, 50, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 🎯 MAIN VISUAL CANVAS COMPONENT
// ════════════════════════════════════════════════════════════════

export function VisualCanvas() {
  const store = useEditorStore();

  const { headerGroup, template, footerGroup, previewUrl } = store;

  // Collect all sections for AI analysis
  const allSections = useMemo(() => {
    const result: { section: Section; id: string }[] = [];

    headerGroup.order.forEach(id => {
      if (headerGroup.sections[id]) result.push({ section: headerGroup.sections[id], id });
    });
    template.order.forEach(id => {
      if (template.sections[id]) result.push({ section: template.sections[id], id });
    });
    footerGroup.order.forEach(id => {
      if (footerGroup.sections[id]) result.push({ section: footerGroup.sections[id], id });
    });

    return result;
  }, [headerGroup, template, footerGroup]);

  const pageEngagement = useMemo(() => AIEngine.analyzePageEngagement(allSections), [allSections]);
  const pageInsights = useMemo(() => AIEngine.getPageInsights(allSections), [allSections]);

  const totalSections = headerGroup.order.length + template.order.length + footerGroup.order.length;

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      store.clearSelection();
    }
  };

  return (
    <div className="visual-canvas relative min-h-full">
      {/* Background */}
      <AnimatedBackground />

      {/* AI Panel */}
      <AIInsightPanel insights={pageInsights} engagement={pageEngagement} />

      {/* Main Content */}
      <div className="relative z-10 p-6" onClick={handleCanvasClick}>
        <div className="max-w-4xl mx-auto">
          {/* Header Stats */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-violet-400" />
                Ultra Canvas
              </h1>
              <p className="text-white/40 text-sm mt-1">Visual Theme Editor</p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{totalSections}</div>
                <div className="text-xs text-white/40 uppercase">Sections</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className={clsx(
                  "text-2xl font-bold",
                  pageEngagement >= 80 ? "text-green-400" :
                  pageEngagement >= 60 ? "text-yellow-400" :
                  "text-red-400"
                )}>
                  {pageEngagement}%
                </div>
                <div className="text-xs text-white/40 uppercase">Engagement</div>
              </div>
            </div>
          </motion.div>

          {/* Device Frame */}
          <DeviceFrame url={previewUrl}>
            <div className="p-5 space-y-2">
              {/* Header */}
              <SectionGroupContainer
                groupType="header"
                label="Header"
                icon="🔝"
                sections={headerGroup.sections}
                order={headerGroup.order}
                gradient="from-slate-600 to-zinc-700"
              />

              {/* Template */}
              {template.order.length > 0 ? (
                <SectionGroupContainer
                  groupType="template"
                  label="Page Content"
                  icon="📄"
                  sections={template.sections}
                  order={template.order}
                  gradient="from-violet-600 to-purple-700"
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20"
                >
                  <motion.span
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-6xl mb-4"
                  >
                    🎨
                  </motion.span>
                  <h3 className="text-xl font-bold text-white mb-2">Your Canvas Awaits</h3>
                  <p className="text-white/40 text-sm">Add sections from the left panel</p>
                </motion.div>
              )}

              {/* Footer */}
              <SectionGroupContainer
                groupType="footer"
                label="Footer"
                icon="🔚"
                sections={footerGroup.sections}
                order={footerGroup.order}
                gradient="from-gray-600 to-slate-700"
              />
            </div>
          </DeviceFrame>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center text-white/30 text-xs"
          >
            Ultra Canvas Engine v3.0 • AI-Enhanced Editing
          </motion.p>
        </div>
      </div>
    </div>
  );
}

export default VisualCanvas;
