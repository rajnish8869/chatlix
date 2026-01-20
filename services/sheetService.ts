import { User, Chat, Message, AppSettings, ApiResponse, LogEvent } from '../types';
import { GOOGLE_SCRIPT_URL } from '../constants';

// --- NETWORK UTILS ---

async function fetchWithRetry<T>(
  url: string, 
  options: RequestInit, 
  retries = 2, 
  backoff = 300
): Promise<ApiResponse<T>> {
  if (!url || url.includes('INSERT_YOUR_WEB_APP_URL_HERE')) {
    return { success: false, error: "Setup Required: Please set GOOGLE_SCRIPT_URL in constants.ts" };
  }
  
  if (url.includes("docs.google.com/spreadsheets")) {
    return { 
      success: false, 
      error: "Configuration Error: You provided a Spreadsheet URL. You must deploy the Apps Script as a Web App and use that URL (ending in /exec)." 
    };
  }

  try {
    const response = await fetch(url, { ...options, redirect: 'follow' });
    
    if (response.status === 405) {
      throw new Error("Method Not Allowed (405). Check URL.");
    }

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const text = await response.text();

    if (text.trim().startsWith('<')) {
        throw new Error("Invalid Response: Endpoint returned HTML.");
    }

    let data: any;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`Failed to parse JSON response: ${text.substring(0, 50)}...`);
    }

    if (!data.success && data.error) {
       if (typeof data.error === 'string' && (data.error.includes("reading 'getDataRange'") || data.error.includes("null"))) {
         data.error = "Backend Setup Incomplete.";
       }
    }

    return data;
  } catch (err) {
    const msg = (err as Error).message;
    if (retries > 0) {
      // Exponential backoff
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    // Return a clean error object instead of throwing, to prevent app crashes
    return { success: false, error: msg === 'Failed to fetch' ? 'Network Error' : msg };
  }
}

// --- API IMPLEMENTATION ---

async function postToSheet<T>(action: string, payload: any = {}): Promise<ApiResponse<T>> {
  return fetchWithRetry<T>(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
    body: JSON.stringify({ action, ...payload }),
  });
}

export const sheetService = {
  login: (email: string, password: string) => 
    postToSheet<User>('login', { email, password }),

  signup: (username: string, email: string, password: string) => 
    postToSheet<User>('signup', { username, email, password }),
  
  fetchContacts: (userId: string) =>
    postToSheet<User[]>('getContacts', { user_id: userId }),

  createChat: (userId: string, participants: string[]) =>
    postToSheet<Chat>('createChat', { user_id: userId, participants }),

  fetchChats: (userId: string, lastUpdated?: string) => 
    postToSheet<Chat[]>('getChats', { user_id: userId, after_timestamp: lastUpdated }),
  
  // Updated to support afterTimestamp for delta sync
  fetchMessages: (chatId: string, limit: number = 50, beforeTimestamp?: string, afterTimestamp?: string) => 
    postToSheet<Message[]>('getMessages', { 
      chat_id: chatId, 
      limit, 
      before_timestamp: beforeTimestamp,
      after_timestamp: afterTimestamp 
    }),
  
  sendMessage: (chatId: string, senderId: string, message: string, tempId?: string) => 
    postToSheet<Message>('sendMessage', { chat_id: chatId, sender_id: senderId, message, temp_id: tempId }),
    
  updateMessageStatus: (chatId: string, messageIds: string[], status: 'delivered' | 'read') =>
    postToSheet<void>('updateMessageStatus', { chat_id: chatId, message_ids: messageIds, status }),

  fetchSettings: () => 
    postToSheet<AppSettings>('getSettings'),

  logEvent: (event: LogEvent) => 
    postToSheet<void>('logEvent', event),
};