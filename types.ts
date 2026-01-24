

export interface User {
  user_id: string; // Matches Firebase Auth UID
  username: string;
  email: string;
  status: string;
  last_seen: string;
  is_blocked: boolean;
  publicKey?: string; // Base64 encoded JWK public key
  privateKey?: string; // Base64 encoded JWK private key (Backup for multi-device)
  enable_groups?: boolean;
  profile_picture?: string; // Base64 Data URL
}

export interface Chat {
  chat_id: string; // Firestore Doc ID
  type: 'private' | 'group';
  participants: string[]; 
  created_at: string;
  updated_at?: string; 
  last_message?: Message; 
  name?: string;
  // E2EE for Groups
  key_issuer_id?: string; // The user who generated the group key
  encrypted_keys?: Record<string, string>; // Map of userID -> Encrypted Group Key (Base64)
}

export interface Message {
  message_id: string; // Firestore Doc ID
  chat_id: string;
  sender_id: string;
  message: string;
  type: 'text' | 'image' | 'system' | 'encrypted' | 'audio';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
  replyTo?: {
      message_id: string;
      sender_id: string;
      message: string; // Preview text
      type: 'text' | 'image' | 'encrypted' | 'audio';
  };
  reactions?: Record<string, string>; // userId -> emoji
}

export interface AppSettings {
  max_message_length: number;
  enable_groups: boolean;
  maintenance_mode: boolean;
  announcement: string;
}

export interface LogEvent {
  event: string;
  user_id: string;
  metadata: string; 
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