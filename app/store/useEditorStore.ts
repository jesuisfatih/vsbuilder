import { create } from 'zustand';

interface EditorState {
  template: any; // The full JSON from index.json
  headerGroup: any; // The header-group.json
  footerGroup: any; // The footer-group.json
  selectedId: string | null;
  device: 'desktop' | 'mobile';
  history: any[];

  setTemplate: (data: any) => void;
  setHeaderGroup: (data: any) => void;
  setFooterGroup: (data: any) => void;
  selectNode: (id: string | null) => void;
  setDevice: (device: 'desktop' | 'mobile') => void;
  updateSection: (id: string, newSettings: any) => void;
  moveSection: (activeId: string, overId: string, group: 'header' | 'template' | 'footer') => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  template: { sections: {}, order: [] },
  headerGroup: { sections: {}, order: [] },
  footerGroup: { sections: {}, order: [] },
  selectedId: null,
  device: 'desktop',
  history: [],

  setTemplate: (data) => set({ template: data }),
  setHeaderGroup: (data) => set({ headerGroup: data }),
  setFooterGroup: (data) => set({ footerGroup: data }),
  selectNode: (id) => set({ selectedId: id }),
  setDevice: (device) => set({ device }),

  updateSection: (id, newSettings) => set((state) => {
    // Logic to find section in header, template, or footer and update
    const newTemplate = { ...state.template };
    if (newTemplate.sections[id]) {
      newTemplate.sections[id].settings = {
        ...newTemplate.sections[id].settings,
        ...newSettings
      };
    }
    return { template: newTemplate };
  }),

  moveSection: (activeId, overId, group) => set((state) => {
    // Advanced reordering logic for the million-dollar feel
    return state; // Placeholder for now, real logic follows
  }),
}));
