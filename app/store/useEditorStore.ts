/**
 * 🏛️ ENTERPRISE-GRADE EDITOR STORE
 * Immutable state management with full history tracking
 * Supports sections, blocks, undo/redo, and optimistic updates
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface BlockSettings {
  [key: string]: string | number | boolean | null;
}

export interface Block {
  type: string;
  settings: BlockSettings;
  disabled?: boolean;
}

export interface SectionSettings {
  [key: string]: string | number | boolean | null;
}

export interface Section {
  type: string;
  settings: SectionSettings;
  blocks?: Record<string, Block>;
  block_order?: string[];
  disabled?: boolean;
}

export interface SectionGroup {
  name?: string;
  sections: Record<string, Section>;
  order: string[];
}

export type DeviceMode = 'desktop' | 'mobile';
export type GroupType = 'header' | 'template' | 'footer';

export interface SelectionPath {
  groupType: GroupType;
  sectionId: string;
  blockId?: string;
}

export interface HistoryEntry {
  timestamp: number;
  action: string;
  snapshot: {
    template: SectionGroup;
    headerGroup: SectionGroup;
    footerGroup: SectionGroup;
  };
}

// ============================================
// STORE STATE INTERFACE
// ============================================

interface EditorState {
  // Core Data
  template: SectionGroup;
  headerGroup: SectionGroup;
  footerGroup: SectionGroup;

  // UI State
  selectedPath: SelectionPath | null;
  device: DeviceMode;
  expandedSections: Set<string>;
  activePanel: 'sections' | 'settings' | 'apps';

  // Save State
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;

  // History
  history: HistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;

  // Preview
  previewUrl: string;

  // Computed Helpers
  getSection: (sectionId: string) => { section: Section | null; groupType: GroupType | null };
  getBlock: (sectionId: string, blockId: string) => Block | null;
  getActiveItem: () => { type: 'section' | 'block'; data: Section | Block | null; path: SelectionPath | null };

  // Data Setters
  setTemplate: (data: SectionGroup) => void;
  setHeaderGroup: (data: SectionGroup) => void;
  setFooterGroup: (data: SectionGroup) => void;
  initializeFromServer: (template: SectionGroup, header: SectionGroup, footer: SectionGroup) => void;

  // Selection
  selectSection: (groupType: GroupType, sectionId: string) => void;
  selectBlock: (groupType: GroupType, sectionId: string, blockId: string) => void;
  clearSelection: () => void;

  // Section Operations
  updateSectionSetting: (sectionId: string, key: string, value: any) => void;
  updateSectionSettings: (sectionId: string, settings: Partial<SectionSettings>) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  deleteSection: (groupType: GroupType, sectionId: string) => void;
  addSection: (groupType: GroupType, sectionType: string, afterId?: string, defaultSettings?: SectionSettings) => string;
  moveSection: (groupType: GroupType, fromIndex: number, toIndex: number) => void;
  moveSectionBetweenGroups: (fromGroup: GroupType, toGroup: GroupType, sectionId: string, toIndex: number) => void;

  // Block Operations
  updateBlockSetting: (sectionId: string, blockId: string, key: string, value: any) => void;
  updateBlockSettings: (sectionId: string, blockId: string, settings: Partial<BlockSettings>) => void;
  toggleBlockVisibility: (sectionId: string, blockId: string) => void;
  deleteBlock: (sectionId: string, blockId: string) => void;
  addBlock: (sectionId: string, blockType: string, afterBlockId?: string) => string;
  moveBlock: (sectionId: string, fromIndex: number, toIndex: number) => void;

  // Expand/Collapse
  toggleExpanded: (sectionId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // UI State
  setDevice: (device: DeviceMode) => void;
  setActivePanel: (panel: 'sections' | 'settings' | 'apps') => void;
  setPreviewUrl: (url: string) => void;

  // History (Undo/Redo)
  pushHistory: (action: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Save State
  markDirty: () => void;
  markClean: () => void;
  setSaving: (saving: boolean) => void;

  // Theme Settings
  themeSettings: Record<string, unknown>;
  updateThemeSetting: (key: string, value: unknown) => void;
  setThemeSettings: (settings: Record<string, unknown>) => void;

  // Serialization
  getSerializableState: () => {
    template: SectionGroup;
    headerGroup: SectionGroup;
    footerGroup: SectionGroup;
    themeSettings: Record<string, unknown>;
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const generateId = (): string => {
  return `section_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

const generateBlockId = (): string => {
  return `block_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

const getGroupKey = (groupType: GroupType): 'template' | 'headerGroup' | 'footerGroup' => {
  switch (groupType) {
    case 'header': return 'headerGroup';
    case 'footer': return 'footerGroup';
    default: return 'template';
  }
};

const arrayMove = <T>(arr: T[], from: number, to: number): T[] => {
  const newArr = [...arr];
  const [item] = newArr.splice(from, 1);
  newArr.splice(to, 0, item);
  return newArr;
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // ========== INITIAL STATE ==========
      template: { sections: {}, order: [] },
      headerGroup: { sections: {}, order: [] },
      footerGroup: { sections: {}, order: [] },
      themeSettings: {},

      selectedPath: null,
      device: 'desktop',
      expandedSections: new Set(),
      activePanel: 'sections',

      isDirty: false,
      isSaving: false,
      lastSaved: null,

      history: [],
      historyIndex: -1,
      maxHistorySize: 50,

      previewUrl: '/',

      // ========== COMPUTED HELPERS ==========

      getSection: (sectionId: string) => {
        const state = get();

        if (state.template.sections[sectionId]) {
          return { section: state.template.sections[sectionId], groupType: 'template' as GroupType };
        }
        if (state.headerGroup.sections[sectionId]) {
          return { section: state.headerGroup.sections[sectionId], groupType: 'header' as GroupType };
        }
        if (state.footerGroup.sections[sectionId]) {
          return { section: state.footerGroup.sections[sectionId], groupType: 'footer' as GroupType };
        }

        return { section: null, groupType: null };
      },

      getBlock: (sectionId: string, blockId: string) => {
        const { section } = get().getSection(sectionId);
        return section?.blocks?.[blockId] || null;
      },

      getActiveItem: () => {
        const state = get();
        const path = state.selectedPath;

        if (!path) {
          return { type: 'section', data: null, path: null };
        }

        const { section } = state.getSection(path.sectionId);

        if (path.blockId && section?.blocks?.[path.blockId]) {
          return { type: 'block', data: section.blocks[path.blockId], path };
        }

        return { type: 'section', data: section, path };
      },

      // ========== DATA SETTERS ==========

      setTemplate: (data) => set((state) => {
        state.template = data;
        state.isDirty = true;
      }),

      setHeaderGroup: (data) => set((state) => {
        state.headerGroup = data;
        state.isDirty = true;
      }),

      setFooterGroup: (data) => set((state) => {
        state.footerGroup = data;
        state.isDirty = true;
      }),

      initializeFromServer: (template, header, footer) => set((state) => {
        state.template = template;
        state.headerGroup = header;
        state.footerGroup = footer;
        state.isDirty = false;
        state.history = [];
        state.historyIndex = -1;
      }),

      // ========== SELECTION ==========

      selectSection: (groupType, sectionId) => set((state) => {
        state.selectedPath = { groupType, sectionId };
      }),

      selectBlock: (groupType, sectionId, blockId) => set((state) => {
        state.selectedPath = { groupType, sectionId, blockId };
        // Auto-expand parent section
        state.expandedSections.add(sectionId);
      }),

      clearSelection: () => set((state) => {
        state.selectedPath = null;
      }),

      // ========== SECTION OPERATIONS ==========

      updateSectionSetting: (sectionId, key, value) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]) {
          state[groupKey].sections[sectionId].settings[key] = value;
          state.isDirty = true;
        }
      }),

      updateSectionSettings: (sectionId, settings) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]) {
          Object.assign(state[groupKey].sections[sectionId].settings, settings);
          state.isDirty = true;
        }
      }),

      toggleSectionVisibility: (sectionId) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]) {
          const section = state[groupKey].sections[sectionId];
          section.disabled = !section.disabled;
          state.isDirty = true;
        }
      }),

      deleteSection: (groupType, sectionId) => set((state) => {
        const groupKey = getGroupKey(groupType);

        if (state[groupKey].sections[sectionId]) {
          // Push history before deletion
          get().pushHistory(`Delete section ${sectionId}`);

          delete state[groupKey].sections[sectionId];
          state[groupKey].order = state[groupKey].order.filter(id => id !== sectionId);

          // Clear selection if deleted section was selected
          if (state.selectedPath?.sectionId === sectionId) {
            state.selectedPath = null;
          }

          state.isDirty = true;
        }
      }),

      addSection: (groupType, sectionType, afterId, defaultSettings = {}) => {
        const newId = generateId();

        set((state) => {
          const groupKey = getGroupKey(groupType);

          // Create new section with default settings
          state[groupKey].sections[newId] = {
            type: sectionType,
            settings: { ...defaultSettings },
            blocks: {},
            block_order: [],
          };

          // Add to order
          if (afterId) {
            const afterIndex = state[groupKey].order.indexOf(afterId);
            if (afterIndex !== -1) {
              state[groupKey].order.splice(afterIndex + 1, 0, newId);
            } else {
              state[groupKey].order.push(newId);
            }
          } else {
            state[groupKey].order.push(newId);
          }

          state.isDirty = true;
        });

        return newId;
      },

      moveSection: (groupType, fromIndex, toIndex) => set((state) => {
        const groupKey = getGroupKey(groupType);
        state[groupKey].order = arrayMove(state[groupKey].order, fromIndex, toIndex);
        state.isDirty = true;
      }),

      moveSectionBetweenGroups: (fromGroup, toGroup, sectionId, toIndex) => set((state) => {
        const fromKey = getGroupKey(fromGroup);
        const toKey = getGroupKey(toGroup);

        const section = state[fromKey].sections[sectionId];
        if (!section) return;

        // Remove from source
        delete state[fromKey].sections[sectionId];
        state[fromKey].order = state[fromKey].order.filter(id => id !== sectionId);

        // Add to destination
        state[toKey].sections[sectionId] = section;
        state[toKey].order.splice(toIndex, 0, sectionId);

        state.isDirty = true;
      }),

      // ========== BLOCK OPERATIONS ==========

      updateBlockSetting: (sectionId, blockId, key, value) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]?.blocks?.[blockId]) {
          state[groupKey].sections[sectionId].blocks![blockId].settings[key] = value;
          state.isDirty = true;
        }
      }),

      updateBlockSettings: (sectionId, blockId, settings) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]?.blocks?.[blockId]) {
          Object.assign(state[groupKey].sections[sectionId].blocks![blockId].settings, settings);
          state.isDirty = true;
        }
      }),

      toggleBlockVisibility: (sectionId, blockId) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]?.blocks?.[blockId]) {
          const block = state[groupKey].sections[sectionId].blocks![blockId];
          block.disabled = !block.disabled;
          state.isDirty = true;
        }
      }),

      deleteBlock: (sectionId, blockId) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]?.blocks?.[blockId]) {
          delete state[groupKey].sections[sectionId].blocks![blockId];
          state[groupKey].sections[sectionId].block_order =
            state[groupKey].sections[sectionId].block_order?.filter(id => id !== blockId) || [];

          // Clear selection if deleted block was selected
          if (state.selectedPath?.blockId === blockId) {
            state.selectedPath = {
              groupType: state.selectedPath.groupType,
              sectionId: state.selectedPath.sectionId
            };
          }

          state.isDirty = true;
        }
      }),

      addBlock: (sectionId, blockType, afterBlockId) => {
        const newBlockId = generateBlockId();

        set((state) => {
          const groupKey = (() => {
            if (state.template.sections[sectionId]) return 'template';
            if (state.headerGroup.sections[sectionId]) return 'headerGroup';
            if (state.footerGroup.sections[sectionId]) return 'footerGroup';
            return null;
          })();

          if (groupKey && state[groupKey].sections[sectionId]) {
            const section = state[groupKey].sections[sectionId];

            // Initialize blocks if needed
            if (!section.blocks) section.blocks = {};
            if (!section.block_order) section.block_order = [];

            // Create block
            section.blocks[newBlockId] = {
              type: blockType,
              settings: {},
            };

            // Add to order
            if (afterBlockId) {
              const afterIndex = section.block_order.indexOf(afterBlockId);
              if (afterIndex !== -1) {
                section.block_order.splice(afterIndex + 1, 0, newBlockId);
              } else {
                section.block_order.push(newBlockId);
              }
            } else {
              section.block_order.push(newBlockId);
            }

            state.isDirty = true;
          }
        });

        return newBlockId;
      },

      moveBlock: (sectionId, fromIndex, toIndex) => set((state) => {
        const groupKey = (() => {
          if (state.template.sections[sectionId]) return 'template';
          if (state.headerGroup.sections[sectionId]) return 'headerGroup';
          if (state.footerGroup.sections[sectionId]) return 'footerGroup';
          return null;
        })();

        if (groupKey && state[groupKey].sections[sectionId]?.block_order) {
          state[groupKey].sections[sectionId].block_order =
            arrayMove(state[groupKey].sections[sectionId].block_order!, fromIndex, toIndex);
          state.isDirty = true;
        }
      }),

      // ========== EXPAND/COLLAPSE ==========

      toggleExpanded: (sectionId) => set((state) => {
        if (state.expandedSections.has(sectionId)) {
          state.expandedSections.delete(sectionId);
        } else {
          state.expandedSections.add(sectionId);
        }
      }),

      expandAll: () => set((state) => {
        const allIds = [
          ...state.template.order,
          ...state.headerGroup.order,
          ...state.footerGroup.order,
        ];
        state.expandedSections = new Set(allIds);
      }),

      collapseAll: () => set((state) => {
        state.expandedSections = new Set();
      }),

      // ========== UI STATE ==========

      setDevice: (device) => set((state) => {
        state.device = device;
      }),

      setActivePanel: (panel) => set((state) => {
        state.activePanel = panel;
      }),

      setPreviewUrl: (url) => set((state) => {
        state.previewUrl = url;
      }),

      // ========== HISTORY (UNDO/REDO) ==========

      pushHistory: (action) => set((state) => {
        const snapshot = {
          template: JSON.parse(JSON.stringify(state.template)),
          headerGroup: JSON.parse(JSON.stringify(state.headerGroup)),
          footerGroup: JSON.parse(JSON.stringify(state.footerGroup)),
        };

        const entry: HistoryEntry = {
          timestamp: Date.now(),
          action,
          snapshot,
        };

        // Remove any redo history
        state.history = state.history.slice(0, state.historyIndex + 1);

        // Add new entry
        state.history.push(entry);

        // Limit history size
        if (state.history.length > state.maxHistorySize) {
          state.history = state.history.slice(-state.maxHistorySize);
        }

        state.historyIndex = state.history.length - 1;
      }),

      undo: () => set((state) => {
        if (state.historyIndex < 0) return;

        const entry = state.history[state.historyIndex];
        if (entry) {
          state.template = entry.snapshot.template;
          state.headerGroup = entry.snapshot.headerGroup;
          state.footerGroup = entry.snapshot.footerGroup;
          state.historyIndex -= 1;
          state.isDirty = true;
        }
      }),

      redo: () => set((state) => {
        if (state.historyIndex >= state.history.length - 1) return;

        state.historyIndex += 1;
        const entry = state.history[state.historyIndex];
        if (entry) {
          state.template = entry.snapshot.template;
          state.headerGroup = entry.snapshot.headerGroup;
          state.footerGroup = entry.snapshot.footerGroup;
          state.isDirty = true;
        }
      }),

      canUndo: () => get().historyIndex >= 0,
      canRedo: () => get().historyIndex < get().history.length - 1,

      // ========== SAVE STATE ==========

      markDirty: () => set((state) => {
        state.isDirty = true;
      }),

      markClean: () => set((state) => {
        state.isDirty = false;
        state.lastSaved = new Date();
      }),

      setSaving: (saving) => set((state) => {
        state.isSaving = saving;
      }),

      // ========== THEME SETTINGS ==========

      updateThemeSetting: (key, value) => set((state) => {
        state.themeSettings[key] = value;
        state.isDirty = true;
      }),

      setThemeSettings: (settings) => set((state) => {
        state.themeSettings = settings;
      }),

      // ========== SERIALIZATION ==========

      getSerializableState: () => {
        const state = get();
        return {
          template: state.template,
          headerGroup: state.headerGroup,
          footerGroup: state.footerGroup,
          themeSettings: state.themeSettings,
        };
      },
    }))
  )
);

// ============================================
// SELECTORS (for performance optimization)
// ============================================

export const useSelectedSection = () =>
  useEditorStore((state) => {
    if (!state.selectedPath) return null;
    return state.getSection(state.selectedPath.sectionId).section;
  });

export const useSelectedBlock = () =>
  useEditorStore((state) => {
    if (!state.selectedPath?.blockId) return null;
    return state.getBlock(state.selectedPath.sectionId, state.selectedPath.blockId);
  });

export const useIsDirty = () => useEditorStore((state) => state.isDirty);
export const useIsSaving = () => useEditorStore((state) => state.isSaving);
export const useDevice = () => useEditorStore((state) => state.device);
