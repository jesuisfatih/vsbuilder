/**
 * Section Builder Store
 * Manages the state for creating and editing custom section schemas
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
    type BlockSchema,
    type SectionSchema,
    type SettingSchema,
    type SettingType,
    createBlockSchema,
    createSettingSchema,
    schemaToShopifyJson,
    validateSectionSchema
} from "../config/sectionSchema";

interface BuilderState {
  // Current schema being edited
  schema: SectionSchema;

  // UI State
  selectedSettingIndex: number | null;
  selectedBlockIndex: number | null;
  selectedBlockSettingIndex: number | null;
  isPreviewMode: boolean;
  validationErrors: string[];

  // Dirty flag
  isDirty: boolean;

  // Schema Actions
  setSchema: (schema: SectionSchema) => void;
  resetSchema: () => void;
  updateSchemaName: (name: string) => void;
  updateSchemaTag: (tag: string) => void;
  updateSchemaClass: (className: string) => void;
  updateSchemaLimit: (limit: number | undefined) => void;
  updateMaxBlocks: (max: number | undefined) => void;

  // Settings Actions
  addSetting: (type: SettingType, insertIndex?: number) => void;
  updateSetting: (index: number, updates: Partial<SettingSchema>) => void;
  removeSetting: (index: number) => void;
  moveSetting: (fromIndex: number, toIndex: number) => void;
  duplicateSetting: (index: number) => void;

  // Block Actions
  addBlock: (name: string) => void;
  updateBlock: (index: number, updates: Partial<BlockSchema>) => void;
  removeBlock: (index: number) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  duplicateBlock: (index: number) => void;

  // Block Settings Actions
  addBlockSetting: (blockIndex: number, type: SettingType) => void;
  updateBlockSetting: (blockIndex: number, settingIndex: number, updates: Partial<SettingSchema>) => void;
  removeBlockSetting: (blockIndex: number, settingIndex: number) => void;
  moveBlockSetting: (blockIndex: number, fromIndex: number, toIndex: number) => void;

  // Selection
  selectSetting: (index: number | null) => void;
  selectBlock: (index: number | null) => void;
  selectBlockSetting: (settingIndex: number | null) => void;

  // Preview
  setPreviewMode: (enabled: boolean) => void;

  // Validation & Export
  validate: () => boolean;
  exportJson: () => string;
  importJson: (json: string) => boolean;

  // Presets
  addPreset: (name: string) => void;
  removePreset: (index: number) => void;
  updatePreset: (index: number, updates: { name?: string; settings?: Record<string, unknown> }) => void;
}

const createEmptySchema = (): SectionSchema => ({
  name: "New Section",
  settings: [],
  blocks: [],
});

function generateSettingId(prefix: string, existing: SettingSchema[]): string {
  const ids = new Set(existing.map(s => s.id));
  let counter = 1;
  let id = prefix;
  while (ids.has(id)) {
    id = `${prefix}_${counter}`;
    counter++;
  }
  return id;
}

function generateBlockType(existing: BlockSchema[]): string {
  const types = new Set(existing.map(b => b.type));
  let counter = 1;
  let type = "block";
  while (types.has(type)) {
    type = `block_${counter}`;
    counter++;
  }
  return type;
}

export const useSectionBuilderStore = create<BuilderState>()(
  immer((set, get) => ({
    // Initial State
    schema: createEmptySchema(),
    selectedSettingIndex: null,
    selectedBlockIndex: null,
    selectedBlockSettingIndex: null,
    isPreviewMode: false,
    validationErrors: [],
    isDirty: false,

    // Schema Actions
    setSchema: (schema) => {
      set((state) => {
        state.schema = schema;
        state.isDirty = false;
        state.selectedSettingIndex = null;
        state.selectedBlockIndex = null;
        state.selectedBlockSettingIndex = null;
      });
    },

    resetSchema: () => {
      set((state) => {
        state.schema = createEmptySchema();
        state.isDirty = false;
        state.selectedSettingIndex = null;
        state.selectedBlockIndex = null;
        state.selectedBlockSettingIndex = null;
        state.validationErrors = [];
      });
    },

    updateSchemaName: (name) => {
      set((state) => {
        state.schema.name = name;
        state.isDirty = true;
      });
    },

    updateSchemaTag: (tag) => {
      set((state) => {
        state.schema.tag = tag || undefined;
        state.isDirty = true;
      });
    },

    updateSchemaClass: (className) => {
      set((state) => {
        state.schema.class = className || undefined;
        state.isDirty = true;
      });
    },

    updateSchemaLimit: (limit) => {
      set((state) => {
        state.schema.limit = limit;
        state.isDirty = true;
      });
    },

    updateMaxBlocks: (max) => {
      set((state) => {
        state.schema.max_blocks = max;
        state.isDirty = true;
      });
    },

    // Settings Actions
    addSetting: (type, insertIndex) => {
      set((state) => {
        const id = generateSettingId(type, state.schema.settings);
        const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
        const newSetting = createSettingSchema(type, id, label);

        if (insertIndex !== undefined && insertIndex >= 0) {
          state.schema.settings.splice(insertIndex + 1, 0, newSetting);
          state.selectedSettingIndex = insertIndex + 1;
        } else {
          state.schema.settings.push(newSetting);
          state.selectedSettingIndex = state.schema.settings.length - 1;
        }
        state.isDirty = true;
      });
    },

    updateSetting: (index, updates) => {
      set((state) => {
        if (state.schema.settings[index]) {
          Object.assign(state.schema.settings[index], updates);
          state.isDirty = true;
        }
      });
    },

    removeSetting: (index) => {
      set((state) => {
        state.schema.settings.splice(index, 1);
        state.selectedSettingIndex = null;
        state.isDirty = true;
      });
    },

    moveSetting: (fromIndex, toIndex) => {
      set((state) => {
        const [item] = state.schema.settings.splice(fromIndex, 1);
        state.schema.settings.splice(toIndex, 0, item);
        state.selectedSettingIndex = toIndex;
        state.isDirty = true;
      });
    },

    duplicateSetting: (index) => {
      set((state) => {
        const original = state.schema.settings[index];
        if (!original) return;

        const id = generateSettingId(original.type, state.schema.settings);
        const duplicate: SettingSchema = {
          ...JSON.parse(JSON.stringify(original)),
          id,
          label: `${original.label} (copy)`,
        };

        state.schema.settings.splice(index + 1, 0, duplicate);
        state.selectedSettingIndex = index + 1;
        state.isDirty = true;
      });
    },

    // Block Actions
    addBlock: (name) => {
      set((state) => {
        if (!state.schema.blocks) {
          state.schema.blocks = [];
        }

        const type = generateBlockType(state.schema.blocks);
        const newBlock = createBlockSchema(type, name);
        state.schema.blocks.push(newBlock);
        state.selectedBlockIndex = state.schema.blocks.length - 1;
        state.isDirty = true;
      });
    },

    updateBlock: (index, updates) => {
      set((state) => {
        if (state.schema.blocks?.[index]) {
          Object.assign(state.schema.blocks[index], updates);
          state.isDirty = true;
        }
      });
    },

    removeBlock: (index) => {
      set((state) => {
        state.schema.blocks?.splice(index, 1);
        state.selectedBlockIndex = null;
        state.selectedBlockSettingIndex = null;
        state.isDirty = true;
      });
    },

    moveBlock: (fromIndex, toIndex) => {
      set((state) => {
        if (!state.schema.blocks) return;
        const [item] = state.schema.blocks.splice(fromIndex, 1);
        state.schema.blocks.splice(toIndex, 0, item);
        state.selectedBlockIndex = toIndex;
        state.isDirty = true;
      });
    },

    duplicateBlock: (index) => {
      set((state) => {
        const original = state.schema.blocks?.[index];
        if (!original || !state.schema.blocks) return;

        const type = generateBlockType(state.schema.blocks);
        const duplicate: BlockSchema = {
          ...JSON.parse(JSON.stringify(original)),
          type,
          name: `${original.name} (copy)`,
        };

        state.schema.blocks.splice(index + 1, 0, duplicate);
        state.selectedBlockIndex = index + 1;
        state.isDirty = true;
      });
    },

    // Block Settings Actions
    addBlockSetting: (blockIndex, type) => {
      set((state) => {
        const block = state.schema.blocks?.[blockIndex];
        if (!block) return;

        const id = generateSettingId(type, block.settings);
        const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
        const newSetting = createSettingSchema(type, id, label);

        block.settings.push(newSetting);
        state.selectedBlockSettingIndex = block.settings.length - 1;
        state.isDirty = true;
      });
    },

    updateBlockSetting: (blockIndex, settingIndex, updates) => {
      set((state) => {
        const setting = state.schema.blocks?.[blockIndex]?.settings?.[settingIndex];
        if (setting) {
          Object.assign(setting, updates);
          state.isDirty = true;
        }
      });
    },

    removeBlockSetting: (blockIndex, settingIndex) => {
      set((state) => {
        state.schema.blocks?.[blockIndex]?.settings.splice(settingIndex, 1);
        state.selectedBlockSettingIndex = null;
        state.isDirty = true;
      });
    },

    moveBlockSetting: (blockIndex, fromIndex, toIndex) => {
      set((state) => {
        const settings = state.schema.blocks?.[blockIndex]?.settings;
        if (!settings) return;

        const [item] = settings.splice(fromIndex, 1);
        settings.splice(toIndex, 0, item);
        state.selectedBlockSettingIndex = toIndex;
        state.isDirty = true;
      });
    },

    // Selection
    selectSetting: (index) => {
      set((state) => {
        state.selectedSettingIndex = index;
        state.selectedBlockIndex = null;
        state.selectedBlockSettingIndex = null;
      });
    },

    selectBlock: (index) => {
      set((state) => {
        state.selectedBlockIndex = index;
        state.selectedSettingIndex = null;
        state.selectedBlockSettingIndex = null;
      });
    },

    selectBlockSetting: (settingIndex) => {
      set((state) => {
        state.selectedBlockSettingIndex = settingIndex;
      });
    },

    // Preview
    setPreviewMode: (enabled) => {
      set((state) => {
        state.isPreviewMode = enabled;
      });
    },

    // Validation & Export
    validate: () => {
      const errors = validateSectionSchema(get().schema);
      set((state) => {
        state.validationErrors = errors;
      });
      return errors.length === 0;
    },

    exportJson: () => {
      return schemaToShopifyJson(get().schema);
    },

    importJson: (json) => {
      try {
        const parsed = JSON.parse(json);
        get().setSchema({
          name: parsed.name || "Imported Section",
          tag: parsed.tag,
          class: parsed.class,
          limit: parsed.limit,
          settings: parsed.settings || [],
          blocks: parsed.blocks || [],
          max_blocks: parsed.max_blocks,
          presets: parsed.presets,
          enabled_on: parsed.enabled_on,
          disabled_on: parsed.disabled_on,
        });
        return true;
      } catch {
        return false;
      }
    },

    // Presets
    addPreset: (name) => {
      set((state) => {
        if (!state.schema.presets) {
          state.schema.presets = [];
        }

        // Create preset with current default values
        const settings: Record<string, unknown> = {};
        state.schema.settings.forEach(s => {
          if (s.default !== undefined) {
            settings[s.id] = s.default;
          }
        });

        state.schema.presets.push({ name, settings });
        state.isDirty = true;
      });
    },

    removePreset: (index) => {
      set((state) => {
        state.schema.presets?.splice(index, 1);
        state.isDirty = true;
      });
    },

    updatePreset: (index, updates) => {
      set((state) => {
        const preset = state.schema.presets?.[index];
        if (preset) {
          if (updates.name !== undefined) preset.name = updates.name;
          if (updates.settings !== undefined) preset.settings = updates.settings;
          state.isDirty = true;
        }
      });
    },
  }))
);

// Selectors
export const useSelectedSetting = () =>
  useSectionBuilderStore((state) => {
    if (state.selectedSettingIndex === null) return null;
    return state.schema.settings[state.selectedSettingIndex] || null;
  });

export const useSelectedBlock = () =>
  useSectionBuilderStore((state) => {
    if (state.selectedBlockIndex === null) return null;
    return state.schema.blocks?.[state.selectedBlockIndex] || null;
  });

export const useSelectedBlockSetting = () =>
  useSectionBuilderStore((state) => {
    if (state.selectedBlockIndex === null || state.selectedBlockSettingIndex === null) return null;
    return state.schema.blocks?.[state.selectedBlockIndex]?.settings?.[state.selectedBlockSettingIndex] || null;
  });

export const useSchemaJson = () =>
  useSectionBuilderStore((state) => schemaToShopifyJson(state.schema));
