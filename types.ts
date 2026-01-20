export interface User {
  user_id: string;
  username: string;
  email: string;
  status: string;
  last_seen: string;
  is_blocked: boolean;
}

export interface Chat {
  chat_id: string;
  type: 'private' | 'group';
  participants: string[]; // JSON array of user_ids
  created_at: string;
  updated_at?: string; // For delta sync
  last_message?: Message; // Virtual field for UI
  name?: string; // Virtual field for group name or computed name
}

export interface Message {
  message_id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  type: 'text' | 'image' | 'system';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed'; 
}

export interface AppSettings {
  polling_interval: number;
  max_message_length: number;
  enable_groups: boolean;
  maintenance_mode: boolean;
  announcement: string;
}

export interface LogEvent {
  event: string;
  user_id: string;
  metadata: string; // JSON string
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SyncResponse {
  chats: Chat[];
  messages: Message[];
  removed_chat_ids: string[];
}