import { User, Chat, Message, AppSettings, ApiResponse, LogEvent } from '../types';
import { GOOGLE_SCRIPT_URL } from '../constants';

// --- NETWORK UTILS ---

async function fetchWithRetry<T>(
  url: string, 
  options: RequestInit, 
  retries = 2, 
  backoff = 300
): Promise<ApiResponse<T>> {
  // 1. Validation: Check for common configuration errors
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
    const response = await fetch(url, options);
    
    // 2. Specific HTTP Error Handling
    if (response.status === 405) {
      throw new Error("Method Not Allowed (405). This usually happens if you are using the Spreadsheet URL instead of the Script Web App URL.");
    }

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    // 3. Content Type Validation
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") === -1) {
      const text = await response.text();
      // If we get HTML (like a Google Sign-in page or Sheet UI)
      if (text.trim().startsWith('<')) {
        throw new Error("Invalid Response: Endpoint returned HTML. Check if the Web App is deployed as 'Anyone' (accessible without login).");
      }
    }

    const data = await response.json();

    // 4. Backend Error Mapping (User Friendliness)
    if (!data.success && data.error) {
       // Check for specific Google Apps Script error when sheets don't exist
       if (typeof data.error === 'string' && (data.error.includes("reading 'getDataRange'") || data.error.includes("null"))) {
         data.error = "Backend Setup Incomplete: The required sheets (users, chats, etc.) do not exist. Please open your Google Apps Script editor and run the 'setup' function.";
       }
    }

    return data;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Retrying... attempts left: ${retries}. Error: ${(err as Error).message}`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    console.error("Fetch failed after retries:", err);
    return { success: false, error: (err as Error).message };
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
  
  fetchMessages: (chatId: string, limit: number = 50, beforeTimestamp?: string) => 
    postToSheet<Message[]>('getMessages', { chat_id: chatId, limit, before_timestamp: beforeTimestamp }),
  
  sendMessage: (chatId: string, senderId: string, message: string, tempId?: string) => 
    postToSheet<Message>('sendMessage', { chat_id: chatId, sender_id: senderId, message, temp_id: tempId }),
    
  fetchSettings: () => 
    postToSheet<AppSettings>('getSettings'),

  logEvent: (event: LogEvent) => 
    postToSheet<void>('logEvent', event),
};