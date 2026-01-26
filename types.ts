
export interface User {
  user_id: string; // Matches Firebase Auth UID
  username: string;
  email: string;
  status: string;
  last_seen: string;
  is_blocked: boolean; // Admin block status
  publicKey?: string; // Base64 encoded JWK public key
  privateKey?: string; // Base64 encoded JWK private key (Backup for multi-device)
  enable_groups?: boolean;
  profile_picture?: string; // Base64 Data URL
  blocked_users?: string[]; // Array of User IDs blocked by this user
  chat_wallpapers?: Record<string, Wallpaper>; // Map of chatId -> Wallpaper (Personal overrides)
  fcm_tokens?: string[]; // Array of active FCM tokens for push notifications
  ptt_auto_accept_ids?: string[]; // IDs of users trusted for instant PTT
}

export interface Chat {
  chat_id: string; // Firestore Doc ID
  type: 'private' | 'group';
  participants: string[]; 
  admins?: string[]; // Array of User IDs who are admins
  created_at: string;
  updated_at?: string; 
  last_message?: Message; 
  name?: string;
  group_image?: string; // Base64 or URL for group avatar
  // E2EE for Groups
  key_issuer_id?: string; // The user who generated the group key
  encrypted_keys?: Record<string, string>; // Map of userID -> Encrypted Group Key (Base64)
  wallpaper?: Wallpaper; // Shared wallpaper for groups
}

export interface Wallpaper {
  type: 'image' | 'color' | 'gradient';
  value: string; // URL, Hex Code, or CSS Gradient string
  opacity?: number; // 0.1 to 1.0 (for readability adjustment)
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

export interface CallSession {
    call_id: string;
    callerId: string;
    calleeId: string;
    type: 'audio' | 'video' | 'ptt';
    status: 'offering' | 'connected' | 'ended' | 'rejected';
    offer?: any;
    answer?: any;
    timestamp: number;
    endedAt?: number;
    duration?: number;
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
