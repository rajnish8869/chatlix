
import { create } from 'zustand';
import { Chat, Message, User, CallSession, AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  contacts: User[];
  callHistory: CallSession[];
  typingStatus: Record<string, string[]>;
  settings: AppSettings;
  isOffline: boolean;
  syncing: boolean;
  // Offline Queue
  queue: any[];

  // Actions
  setChats: (chats: Chat[]) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  updateMessages: (chatId: string, updater: (prev: Message[]) => Message[]) => void;
  setContacts: (contacts: User[]) => void;
  setCallHistory: (history: CallSession[]) => void;
  setTypingStatus: (chatId: string, userIds: string[]) => void;
  setSettings: (settings: AppSettings) => void;
  setIsOffline: (isOffline: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setQueue: (queue: any[]) => void;
  
  // Specific Utility Actions
  addQueueItem: (item: any) => void;
  clearState: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  messages: {},
  contacts: [],
  callHistory: [],
  typingStatus: {},
  settings: DEFAULT_SETTINGS,
  isOffline: !navigator.onLine,
  syncing: false,
  queue: [],

  setChats: (chats) => set({ chats }),
  
  setMessages: (chatId, messages) => set((state) => ({
    messages: { ...state.messages, [chatId]: messages }
  })),

  updateMessages: (chatId, updater) => set((state) => ({
    messages: { ...state.messages, [chatId]: updater(state.messages[chatId] || []) }
  })),

  setContacts: (contacts) => set({ contacts }),
  setCallHistory: (callHistory) => set({ callHistory }),
  
  setTypingStatus: (chatId, userIds) => set((state) => ({
    typingStatus: { ...state.typingStatus, [chatId]: userIds }
  })),

  setSettings: (settings) => set({ settings }),
  setIsOffline: (isOffline) => set({ isOffline }),
  setSyncing: (syncing) => set({ syncing }),
  setQueue: (queue) => set({ queue }),
  
  addQueueItem: (item) => set((state) => ({
      queue: [...state.queue, item]
  })),

  clearState: () => set({
      chats: [],
      messages: {},
      contacts: [],
      callHistory: [],
      typingStatus: {},
      settings: DEFAULT_SETTINGS,
      syncing: false,
      queue: []
  })
}));
