/**
 * ⚡ ULTRA CANVAS ENGINE v3.1
 * ═══════════════════════════════════════════════════════════════
 * Enterprise-Grade Visual Theme Renderer
 *
 * FIXED: Gradient styles now use inline CSS instead of Tailwind
 * ═══════════════════════════════════════════════════════════════
 */

import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  EyeSlashIcon,
  SparklesIcon,
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
    void: "#0a0a0f",
    abyss: "#12121a",
    neonCyan: "#00fff2",
    neonMagenta: "#ff00ff",
    neonViolet: "#8b5cf6",
    neonAmber: "#fbbf24",
    neonRose: "#f43f5e",
    neonEmerald: "#10b981",
    neonBlue: "#3b82f6",
  },
};

// Pre-defined gradient styles (inline CSS to avoid Tailwind JIT issues)
const GRADIENTS = {
  violet: "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #c026d3 100%)",
  amber: "linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)",
  rose: "linear-gradient(135deg, #e11d48 0%, #db2777 50%, #c026d3 100%)",
  emerald: "linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)",
  indigo: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
  cyan: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #4f46e5 100%)",
  yellow: "linear-gradient(135deg, #facc15 0%, #f59e0b 50%, #ea580c 100%)",
  sky: "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #4f46e5 100%)",
  slate: "linear-gradient(135deg, #64748b 0%, #475569 50%, #334155 100%)",
  gray: "linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)",
  pink: "linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #ef4444 100%)",
  blue: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #14b8a6 100%)",
  purple: "linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6366f1 100%)",
  red: "linear-gradient(135deg, #ef4444 0%, #f43f5e 50%, #ec4899 100%)",
  neutral: "linear-gradient(135deg, #737373 0%, #525252 50%, #404040 100%)",
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

    const firstSection = sections[0]?.section;
    if (firstSection && !["image-banner", "slideshow", "video-hero"].includes(firstSection.type)) {
      insights.push({
        type: "suggestion",
        message: "Consider starting with a hero section for impact",
        confidence: 0.89,
      });
    }

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
  minHeight: number;
  category: string;
}

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  "image-banner": {
    icon: "🖼️",
    label: "Image Banner",
    gradient: GRADIENTS.violet,
    glowColor: TOKENS.colors.neonViolet,
    minHeight: 280,
    category: "HERO",
  },
  "slideshow": {
    icon: "🎠",
    label: "Slideshow",
    gradient: GRADIENTS.amber,
    glowColor: TOKENS.colors.neonAmber,
    minHeight: 280,
    category: "HERO",
  },
  "video-hero": {
    icon: "🎬",
    label: "Video Hero",
    gradient: GRADIENTS.rose,
    glowColor: TOKENS.colors.neonRose,
    minHeight: 280,
    category: "HERO",
  },
  "featured-collection": {
    icon: "✨",
    label: "Featured Collection",
    gradient: GRADIENTS.emerald,
    glowColor: TOKENS.colors.neonEmerald,
    minHeight: 200,
    category: "PRODUCT",
  },
  "featured-product": {
    icon: "💎",
    label: "Featured Product",
    gradient: GRADIENTS.indigo,
    glowColor: TOKENS.colors.neonViolet,
    minHeight: 200,
    category: "PRODUCT",
  },
  "collection-list": {
    icon: "📦",
    label: "Collection List",
    gradient: GRADIENTS.cyan,
    glowColor: TOKENS.colors.neonCyan,
    minHeight: 200,
    category: "PRODUCT",
  },
  "testimonials": {
    icon: "💬",
    label: "Testimonials",
    gradient: GRADIENTS.yellow,
    glowColor: TOKENS.colors.neonAmber,
    minHeight: 160,
    category: "SOCIAL",
  },
  "image-with-text": {
    icon: "📝",
    label: "Image with Text",
    gradient: GRADIENTS.sky,
    glowColor: TOKENS.colors.neonBlue,
    minHeight: 180,
    category: "CONTENT",
  },
  "rich-text": {
    icon: "📄",
    label: "Rich Text",
    gradient: GRADIENTS.slate,
    glowColor: "#888888",
    minHeight: 140,
    category: "CONTENT",
  },
  "multicolumn": {
    icon: "▦",
    label: "Multi-column",
    gradient: GRADIENTS.blue,
    glowColor: TOKENS.colors.neonCyan,
    minHeight: 160,
    category: "CONTENT",
  },
  "newsletter": {
    icon: "📧",
    label: "Newsletter",
    gradient: GRADIENTS.pink,
    glowColor: TOKENS.colors.neonRose,
    minHeight: 140,
    category: "CTA",
  },
  "contact-form": {
    icon: "✉️",
    label: "Contact Form",
    gradient: GRADIENTS.cyan,
    glowColor: TOKENS.colors.neonCyan,
    minHeight: 160,
    category: "CTA",
  },
  "header": {
    icon: "🔝",
    label: "Header",
    gradient: GRADIENTS.gray,
    glowColor: "#666666",
    minHeight: 80,
    category: "NAV",
  },
  "footer": {
    icon: "🔚",
    label: "Footer",
    gradient: GRADIENTS.gray,
    glowColor: "#555555",
    minHeight: 180,
    category: "NAV",
  },
  "announcement-bar": {
    icon: "📢",
    label: "Announcement",
    gradient: GRADIENTS.yellow,
    glowColor: TOKENS.colors.neonAmber,
    minHeight: 60,
    category: "NAV",
  },
  "blog-posts": {
    icon: "📰",
    label: "Blog Posts",
    gradient: GRADIENTS.purple,
    glowColor: TOKENS.colors.neonViolet,
    minHeight: 200,
    category: "CONTENT",
  },
  "video": {
    icon: "🎥",
    label: "Video",
    gradient: GRADIENTS.red,
    glowColor: TOKENS.colors.neonRose,
    minHeight: 240,
    category: "MEDIA",
  },
  "collapsible-content": {
    icon: "📋",
    label: "FAQ / Accordion",
    gradient: GRADIENTS.neutral,
    glowColor: "#888888",
    minHeight: 140,
    category: "CONTENT",
  },
  "custom-liquid": {
    icon: "🧪",
    label: "Custom Liquid",
    gradient: GRADIENTS.slate,
    glowColor: "#666666",
    minHeight: 120,
    category: "CUSTOM",
  },
};

function getConfig(type: string): SectionConfig {
  if (SECTION_CONFIGS[type]) return SECTION_CONFIGS[type];

  // Fuzzy match for dynamic section types
  const normalized = type.toLowerCase().replace(/[-_]/g, "");
  for (const [key, config] of Object.entries(SECTION_CONFIGS)) {
    if (normalized.includes(key.replace(/[-_]/g, ""))) return config;
  }

  return {
    icon: "🔮",
    label: type.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    gradient: GRADIENTS.slate,
    glowColor: "#888888",
    minHeight: 140,
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

    const initial: Particle[] = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      opacity: Math.random() * 0.6 + 0.3,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
    }));
    setParticles(initial);

    const animate = () => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: ((p.x + p.vx + 100) % 100),
        y: ((p.y + p.vy + 100) % 100),
        opacity: Math.max(0.1, p.opacity - 0.003),
      })).filter(p => p.opacity > 0.1));
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
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
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
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
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-6, 6]);
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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 25 }}
      style={{
        rotateX: springX,
        rotateY: springY,
        transformPerspective: 1000,
        minHeight: config.minHeight,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={clsx(
        "section-card relative cursor-pointer",
        "rounded-xl overflow-hidden",
        "transition-all duration-300",
        section.disabled && "opacity-50 grayscale",
        isSelected && "ring-2 ring-white ring-offset-2 ring-offset-black"
      )}
    >
      {/* Main Card Background with Gradient */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: config.gradient,
          opacity: isHovered ? 0.9 : 0.7,
        }}
      />

      {/* Glass overlay */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Particles */}
      <ParticleField active={isHovered} color={config.glowColor} />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-5">
        {/* Icon */}
        <motion.div
          animate={{ scale: isHovered ? 1.15 : 1 }}
          className="text-4xl mb-2"
          style={{
            filter: isHovered ? `drop-shadow(0 0 15px ${config.glowColor})` : "none",
          }}
        >
          {config.icon}
        </motion.div>

        {/* Title */}
        <h3 className="font-bold text-lg text-white text-center drop-shadow-md">
          {title}
        </h3>

        {/* Category Badge */}
        <div
          className="mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          {config.category}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mt-3">
          {blockCount > 0 && (
            <div className="flex items-center gap-1 text-white/70 text-sm">
              <span>📦</span>
              <span>{blockCount}</span>
            </div>
          )}
          <div
            className="flex items-center gap-1 text-sm font-semibold"
            style={{
              color: engagement >= 80 ? "#4ade80" : engagement >= 60 ? "#fbbf24" : "#f87171",
            }}
          >
            <span>⚡</span>
            <span>{engagement}%</span>
          </div>
        </div>

        {/* AI Suggestion on Hover */}
        <AnimatePresence>
          {isHovered && suggestion && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-3 px-3 py-2 rounded-lg text-center"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p className="text-xs text-white/80">💡 {suggestion}</p>
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
            className="absolute top-2 right-2 z-20 px-2 py-1 rounded-full text-xs font-bold text-white"
            style={{
              background: config.gradient,
              boxShadow: `0 0 15px ${config.glowColor}`,
            }}
          >
            ✓ SELECTED
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disabled Overlay */}
      {section.disabled && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="px-3 py-1.5 rounded-full text-white/80 text-sm font-medium flex items-center gap-2"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <EyeSlashIcon className="w-4 h-4" />
            HIDDEN
          </div>
        </div>
      )}

      {/* Hover Glow Effect */}
      {isHovered && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: `0 0 40px ${config.glowColor}40, inset 0 0 20px ${config.glowColor}20`,
          }}
        />
      )}
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
  gradientStyle: string;
}

function SectionGroupContainer({ groupType, label, icon, sections, order, gradientStyle }: SectionGroupContainerProps) {
  const store = useEditorStore();
  const [collapsed, setCollapsed] = useState(false);

  if (order.length === 0) return null;

  return (
    <div className="section-group mb-5">
      {/* Header */}
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all hover:brightness-110"
        style={{ background: gradientStyle }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-bold text-white text-base">{label}</span>
          <div
            className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            {order.length}
          </div>
        </div>
        <ChevronDownIcon
          className={clsx(
            "w-4 h-4 text-white/70 transition-transform duration-200",
            collapsed && "-rotate-90"
          )}
        />
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
            <div className="grid gap-3 pt-3">
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
      className="fixed right-4 top-20 w-64 z-50"
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-white">AI Insights</span>
          </div>
          <ChevronDownIcon className={clsx("w-3 h-3 text-white/50 transition-transform", !expanded && "-rotate-90")} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              {/* Engagement Score */}
              <div className="px-3 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-white/60">Page Engagement</span>
                  <span
                    className="text-base font-bold"
                    style={{ color: engagement >= 80 ? "#4ade80" : engagement >= 60 ? "#fbbf24" : "#f87171" }}
                  >
                    {engagement}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${engagement}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{
                      background: engagement >= 80
                        ? "linear-gradient(90deg, #4ade80, #22c55e)"
                        : engagement >= 60
                        ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                        : "linear-gradient(90deg, #f87171, #ef4444)",
                    }}
                  />
                </div>
              </div>

              {/* Insights */}
              <div className="px-3 py-2 space-y-1.5 max-h-40 overflow-y-auto">
                {insights.length > 0 ? insights.map((insight, i) => (
                  <div
                    key={i}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-white/80"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <span className="mr-1.5">{insightIcons[insight.type]}</span>
                    {insight.message}
                  </div>
                )) : (
                  <p className="text-xs text-white/40 text-center py-1">Looking good! ✨</p>
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
        className="absolute -inset-0.5 rounded-2xl opacity-40 blur-lg"
        style={{ background: "linear-gradient(135deg, #8b5cf6, #06b6d4, #f43f5e)" }}
      />

      {/* Frame */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "#0a0a0f",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        {/* Browser Chrome */}
        <div
          className="flex items-center gap-3 px-3 py-2"
          style={{ background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          {/* Traffic Lights */}
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57", boxShadow: "0 0 6px #ff5f57" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ffbd2e", boxShadow: "0 0 6px #ffbd2e" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840", boxShadow: "0 0 6px #28c840" }} />
          </div>

          {/* URL Bar */}
          <div className="flex-1 ml-3">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span style={{ color: "#4ade80" }}>🔒</span>
              <span className="truncate font-mono text-white/50">
                {url || "your-store.myshopify.com"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors">
              <ArrowPathIcon className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors">
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="overflow-y-auto"
          style={{ minHeight: 500, maxHeight: "70vh", scrollbarWidth: "thin" }}
        >
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
            radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
            linear-gradient(180deg, #0a0a0f 0%, #12121a 100%)
          `,
        }}
      />

      {/* Floating Orbs */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -25, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
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
      <div className="relative z-10 p-5" onClick={handleCanvasClick}>
        <div className="max-w-3xl mx-auto">
          {/* Header Stats */}
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center justify-between"
          >
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-violet-400" />
                Ultra Canvas
              </h1>
              <p className="text-white/40 text-xs mt-0.5">Visual Theme Editor</p>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{totalSections}</div>
                <div className="text-[10px] text-white/40 uppercase">Sections</div>
              </div>
              <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="text-center">
                <div
                  className="text-xl font-bold"
                  style={{ color: pageEngagement >= 80 ? "#4ade80" : pageEngagement >= 60 ? "#fbbf24" : "#f87171" }}
                >
                  {pageEngagement}%
                </div>
                <div className="text-[10px] text-white/40 uppercase">Engagement</div>
              </div>
            </div>
          </motion.div>

          {/* Device Frame */}
          <DeviceFrame url={previewUrl}>
            <div className="p-4">
              {/* Header Group */}
              <SectionGroupContainer
                groupType="header"
                label="Header"
                icon="🔝"
                sections={headerGroup.sections}
                order={headerGroup.order}
                gradientStyle={GRADIENTS.slate}
              />

              {/* Template Group */}
              {template.order.length > 0 ? (
                <SectionGroupContainer
                  groupType="template"
                  label="Page Content"
                  icon="📄"
                  sections={template.sections}
                  order={template.order}
                  gradientStyle={GRADIENTS.violet}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <motion.span
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-5xl mb-3"
                  >
                    🎨
                  </motion.span>
                  <h3 className="text-lg font-bold text-white mb-1">Your Canvas Awaits</h3>
                  <p className="text-white/40 text-sm">Add sections from the left panel</p>
                </motion.div>
              )}

              {/* Footer Group */}
              <SectionGroupContainer
                groupType="footer"
                label="Footer"
                icon="🔚"
                sections={footerGroup.sections}
                order={footerGroup.order}
                gradientStyle={GRADIENTS.gray}
              />
            </div>
          </DeviceFrame>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-5 text-center text-white/25 text-xs"
          >
            Ultra Canvas Engine v3.1 • AI-Enhanced Editing
          </motion.p>
        </div>
      </div>
    </div>
  );
}

export default VisualCanvas;
