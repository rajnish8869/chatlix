

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
}

export interface Chat {
  chat_id: string; // Firestore Doc ID
  type: 'private' | 'group';
  participants: string[]; 
  created_at: string;
  updated_at?: string; 
  last_message?: Message; 
  name?: string; 
}

export interface Message {
  message_id: string; // Firestore Doc ID
  chat_id: string;
  sender_id: string;
  message: string;
  type: 'text' | 'image' | 'system' | 'encrypted';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
  replyTo?: {
      message_id: string;
      sender_id: string;
      message: string; // Preview text
      type: 'text' | 'image' | 'encrypted';
  };
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