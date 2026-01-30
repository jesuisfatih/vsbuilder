/**
 * Collaboration Store
 * Handles real-time presence, cursors, and collaborative editing
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar?: string;
  status: "online" | "away" | "offline";
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
  };
  selection?: {
    groupType: string;
    sectionId: string;
    blockId?: string;
  };
}

export interface CollaborationEvent {
  id: string;
  type: "join" | "leave" | "select" | "update" | "cursor";
  userId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

interface CollaborationState {
  // State
  isConnected: boolean;
  currentUser: Collaborator | null;
  collaborators: Map<string, Collaborator>;
  events: CollaborationEvent[];

  // Connection
  connect: (user: { id: string; name: string; email: string }) => void;
  disconnect: () => void;

  // Presence
  updatePresence: (updates: Partial<Collaborator>) => void;
  updateCursor: (x: number, y: number) => void;
  updateSelection: (groupType: string, sectionId: string, blockId?: string) => void;

  // Remote updates
  addCollaborator: (collaborator: Collaborator) => void;
  removeCollaborator: (userId: string) => void;
  updateCollaborator: (userId: string, updates: Partial<Collaborator>) => void;

  // Events
  addEvent: (event: Omit<CollaborationEvent, "id" | "timestamp">) => void;
  clearEvents: () => void;

  // Helpers
  getActiveCollaborators: () => Collaborator[];
  getCollaboratorById: (id: string) => Collaborator | undefined;
}

// Predefined colors for collaborators
const COLLABORATOR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F8B500", "#00CED1",
];

function getRandomColor(): string {
  return COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

export const useCollaborationStore = create<CollaborationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    isConnected: false,
    currentUser: null,
    collaborators: new Map(),
    events: [],

    // Connection
    connect: (user) => {
      const collaborator: Collaborator = {
        id: user.id,
        name: user.name,
        email: user.email,
        color: getRandomColor(),
        status: "online",
        lastSeen: new Date(),
      };

      set({
        isConnected: true,
        currentUser: collaborator
      });

      get().addEvent({
        type: "join",
        userId: user.id,
        data: { name: user.name },
      });
    },

    disconnect: () => {
      const { currentUser } = get();
      if (currentUser) {
        get().addEvent({
          type: "leave",
          userId: currentUser.id,
        });
      }

      set({
        isConnected: false,
        currentUser: null,
        collaborators: new Map(),
      });
    },

    // Presence
    updatePresence: (updates) => {
      set((state) => {
        if (!state.currentUser) return state;
        return {
          currentUser: {
            ...state.currentUser,
            ...updates,
            lastSeen: new Date(),
          },
        };
      });
    },

    updateCursor: (x, y) => {
      set((state) => {
        if (!state.currentUser) return state;
        return {
          currentUser: {
            ...state.currentUser,
            cursor: { x, y },
            lastSeen: new Date(),
          },
        };
      });
    },

    updateSelection: (groupType, sectionId, blockId) => {
      const { currentUser } = get();
      if (!currentUser) return;

      set((state) => ({
        currentUser: state.currentUser ? {
          ...state.currentUser,
          selection: { groupType, sectionId, blockId },
          lastSeen: new Date(),
        } : null,
      }));

      get().addEvent({
        type: "select",
        userId: currentUser.id,
        data: { groupType, sectionId, blockId },
      });
    },

    // Remote updates
    addCollaborator: (collaborator) => {
      set((state) => {
        const newCollaborators = new Map(state.collaborators);
        newCollaborators.set(collaborator.id, collaborator);
        return { collaborators: newCollaborators };
      });
    },

    removeCollaborator: (userId) => {
      set((state) => {
        const newCollaborators = new Map(state.collaborators);
        newCollaborators.delete(userId);
        return { collaborators: newCollaborators };
      });
    },

    updateCollaborator: (userId, updates) => {
      set((state) => {
        const collaborator = state.collaborators.get(userId);
        if (!collaborator) return state;

        const newCollaborators = new Map(state.collaborators);
        newCollaborators.set(userId, {
          ...collaborator,
          ...updates,
          lastSeen: new Date(),
        });
        return { collaborators: newCollaborators };
      });
    },

    // Events
    addEvent: (event) => {
      set((state) => ({
        events: [
          ...state.events.slice(-49), // Keep last 50 events
          {
            ...event,
            id: generateEventId(),
            timestamp: new Date(),
          },
        ],
      }));
    },

    clearEvents: () => {
      set({ events: [] });
    },

    // Helpers
    getActiveCollaborators: () => {
      const { collaborators, currentUser } = get();
      const active = Array.from(collaborators.values()).filter(
        (c) => c.status !== "offline"
      );

      // Include current user
      if (currentUser) {
        active.unshift(currentUser);
      }

      return active;
    },

    getCollaboratorById: (id) => {
      const { collaborators, currentUser } = get();
      if (currentUser?.id === id) return currentUser;
      return collaborators.get(id);
    },
  }))
);

// Selectors
export const useActiveCollaborators = () =>
  useCollaborationStore((state) => state.getActiveCollaborators());

export const useIsConnected = () =>
  useCollaborationStore((state) => state.isConnected);

export const useCurrentUser = () =>
  useCollaborationStore((state) => state.currentUser);
