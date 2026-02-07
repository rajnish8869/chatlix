
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Chat, Message, User } from '../types';

export class DatabaseService {
    sqlite: SQLiteConnection;
    db: SQLiteDBConnection | null = null;
    private dbName = 'chatlix_db';

    constructor() {
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }

    async init() {
        try {
            this.db = await this.sqlite.createConnection(this.dbName, false, "no-encryption", 1, false);
            await this.db.open();

            // 1. KV Store (Theme, Settings, etc)
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS kv_store (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);

            // 2. Users (Contacts Cache)
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    username TEXT,
                    profile_picture TEXT,
                    public_key TEXT,
                    json_data TEXT
                );
            `);

            // 3. Chats
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS chats (
                    chat_id TEXT PRIMARY KEY,
                    timestamp INTEGER,
                    json_data TEXT
                );
            `);

            // 4. Messages
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS messages (
                    message_id TEXT PRIMARY KEY,
                    chat_id TEXT,
                    timestamp TEXT,
                    json_data TEXT,
                    FOREIGN KEY(chat_id) REFERENCES chats(chat_id)
                );
                CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, timestamp);
            `);

            // 5. Offline Queue
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS offline_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_type TEXT,
                    payload TEXT,
                    created_at INTEGER
                );
            `);

            // 6. Full Text Search Index
            await this.db.execute(`
                CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts4(
                    message_id,
                    chat_id,
                    content
                );
            `);

            console.log("SQLite Database Initialized");

            // Migration: Check for localStorage theme and move to SQLite
            const theme = localStorage.getItem('chatlix_theme');
            if (theme) {
                await this.setKv('chatlix_theme', theme);
            }

        } catch (e) {
            console.error("SQLite Init Error (Using Fallback)", e);
            this.db = null; // Ensure db is null so methods use fallback
        }
    }

    // --- KV STORE ---
    async setKv(key: string, value: string) {
        if (!this.db) {
            localStorage.setItem(key, value);
            return;
        }
        await this.db.run(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`, [key, value]);
    }

    async getKv(key: string): Promise<string | null> {
        if (!this.db) {
            return localStorage.getItem(key);
        }
        try {
            const res = await this.db.query(`SELECT value FROM kv_store WHERE key = ?`, [key]);
            if (res.values && res.values.length > 0) {
                return res.values[0].value;
            }
            return null;
        } catch (e) { return null; }
    }

    async removeKv(key: string) {
        if (!this.db) {
            localStorage.removeItem(key);
            return;
        }
        await this.db.run(`DELETE FROM kv_store WHERE key = ?`, [key]);
    }

    // --- CHATS ---
    async saveChats(chats: Chat[]) {
        if (!this.db) {
            // LocalStorage Fallback
            try {
                const existingStr = localStorage.getItem('chats_backup');
                const existing: Chat[] = existingStr ? JSON.parse(existingStr) : [];
                const map = new Map(existing.map(c => [c.chat_id, c]));
                chats.forEach(c => map.set(c.chat_id, c));
                const merged = Array.from(map.values());
                localStorage.setItem('chats_backup', JSON.stringify(merged));
            } catch(e) {}
            return;
        }
        
        if (chats.length === 0) return;
        
        for (const chat of chats) {
            const ts = new Date(chat.updated_at || chat.created_at || 0).getTime();
            await this.db.run(`INSERT OR REPLACE INTO chats (chat_id, timestamp, json_data) VALUES (?, ?, ?)`, 
                [chat.chat_id, ts, JSON.stringify(chat)]);
        }
    }

    async getChats(): Promise<Chat[]> {
        if (!this.db) {
            // LocalStorage Fallback
            const str = localStorage.getItem('chats_backup');
            return str ? JSON.parse(str) : [];
        }
        const res = await this.db.query(`SELECT json_data FROM chats ORDER BY timestamp DESC`);
        return (res.values || []).map(row => JSON.parse(row.json_data));
    }

    async deleteChats(chatIds: string[]) {
        if (!this.db) {
             const str = localStorage.getItem('chats_backup');
             if(str) {
                 const chats: Chat[] = JSON.parse(str);
                 const filtered = chats.filter(c => !chatIds.includes(c.chat_id));
                 localStorage.setItem('chats_backup', JSON.stringify(filtered));
             }
             return;
        }

        if (chatIds.length === 0) return;
        const placeholders = chatIds.map(() => '?').join(',');
        await this.db.run(`DELETE FROM chats WHERE chat_id IN (${placeholders})`, chatIds);
        await this.db.run(`DELETE FROM messages WHERE chat_id IN (${placeholders})`, chatIds);
        
        // Also cleanup FTS
        await this.db.execute(`DELETE FROM messages_fts WHERE chat_id IN (${placeholders})`);
    }

    // --- MESSAGES ---
    async saveMessage(msg: Message) {
        if (!this.db) {
            // LocalStorage Fallback
            const key = `msgs_${msg.chat_id}`;
            const str = localStorage.getItem(key);
            const msgs: Message[] = str ? JSON.parse(str) : [];
            // Basic Upsert
            const idx = msgs.findIndex(m => m.message_id === msg.message_id);
            if(idx > -1) msgs[idx] = msg; else msgs.push(msg);
            localStorage.setItem(key, JSON.stringify(msgs));
            return;
        }
        await this.db.run(`INSERT OR REPLACE INTO messages (message_id, chat_id, timestamp, json_data) VALUES (?, ?, ?, ?)`,
            [msg.message_id, msg.chat_id, msg.timestamp, JSON.stringify(msg)]);
    }

    async saveMessagesBulk(msgs: Message[]) {
        if (!this.db) {
            // LocalStorage Fallback
            for(const msg of msgs) await this.saveMessage(msg);
            return;
        }

        if (msgs.length === 0) return;

        try {
            await this.db.beginTransaction();
            const query = `INSERT OR REPLACE INTO messages (message_id, chat_id, timestamp, json_data) VALUES (?, ?, ?, ?)`;
            for (const msg of msgs) {
                await this.db.run(query, 
                    [msg.message_id, msg.chat_id, msg.timestamp, JSON.stringify(msg)]);
            }
            await this.db.commitTransaction();
        } catch (e) {
            console.error("Bulk save messages failed, rolling back", e);
            try { await this.db.rollbackTransaction(); } catch (rbErr) {}
        }
    }

    async getMessages(chatId: string, limitVal: number = 50, offsetVal: number = 0): Promise<Message[]> {
        if (!this.db) {
            // LocalStorage Fallback
            const str = localStorage.getItem(`msgs_${chatId}`);
            if(!str) return [];
            let msgs: Message[] = JSON.parse(str);
            // sort desc
            msgs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return msgs.slice(offsetVal, offsetVal + limitVal).reverse();
        }
        const res = await this.db.query(
            `SELECT json_data FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            [chatId, limitVal, offsetVal]
        );
        const msgs = (res.values || []).map(row => JSON.parse(row.json_data));
        return msgs.reverse(); // Return in chronological order for UI
    }

    async deleteMessages(messageIds: string[]) {
        if (!this.db) return; // Complex to implement bulk delete in LS fallback efficiently, skip for now
        
        if (messageIds.length === 0) return;
        const placeholders = messageIds.map(() => '?').join(',');
        await this.db.run(`DELETE FROM messages WHERE message_id IN (${placeholders})`, messageIds);
        
        // Cleanup FTS
        for (const id of messageIds) {
             await this.db.run(`DELETE FROM messages_fts WHERE message_id = ?`, [id]);
        }
    }

    // --- FTS SEARCH ---
    async indexMessage(messageId: string, chatId: string, content: string) {
        if (!this.db) return;
        try {
             // Delete existing entry if any to handle updates
             await this.db.run(`DELETE FROM messages_fts WHERE message_id = ?`, [messageId]);
             await this.db.run(`INSERT INTO messages_fts (message_id, chat_id, content) VALUES (?, ?, ?)`, [messageId, chatId, content]);
        } catch(e) { 
            console.error("FTS Index failed", e); 
        }
    }

    async searchMessages(query: string): Promise<{message: Message, match: string}[]> {
         // FTS is strictly a native feature (SQLite). 
         if (!Capacitor.isNativePlatform()) {
             return [];
         }

         if (!this.db) return [];
         
         const q = `*${query}*`; // Wildcard search
         try {
             const res = await this.db.query(`
                SELECT m.json_data, f.content
                FROM messages_fts f
                JOIN messages m ON f.message_id = m.message_id
                WHERE f.content MATCH ?
                ORDER BY m.timestamp DESC
                LIMIT 50
             `, [q]);
             
             return (res.values || []).map(row => ({
                 message: JSON.parse(row.json_data),
                 match: row.content
             }));
         } catch(e) {
             console.error("FTS Search failed", e);
             return [];
         }
    }

    // --- QUEUE ---
    async addToQueue(actionType: string, payload: any) {
        if (!this.db) {
             const str = localStorage.getItem('offline_queue_bk');
             const queue = str ? JSON.parse(str) : [];
             queue.push({ id: Date.now(), action_type: actionType, payload: JSON.stringify(payload), created_at: Date.now() });
             localStorage.setItem('offline_queue_bk', JSON.stringify(queue));
             return;
        }
        await this.db.run(`INSERT INTO offline_queue (action_type, payload, created_at) VALUES (?, ?, ?)`,
            [actionType, JSON.stringify(payload), Date.now()]);
    }

    async getQueue(): Promise<{ id: number, action_type: string, payload: any }[]> {
        if (!this.db) {
             const str = localStorage.getItem('offline_queue_bk');
             const queue = str ? JSON.parse(str) : [];
             return queue.map((q: any) => ({ ...q, payload: JSON.parse(q.payload) }));
        }
        const res = await this.db.query(`SELECT * FROM offline_queue ORDER BY created_at ASC`);
        return (res.values || []).map(row => ({
            ...row,
            payload: JSON.parse(row.payload)
        }));
    }

    async removeFromQueue(id: number) {
        if (!this.db) {
             const str = localStorage.getItem('offline_queue_bk');
             if(str) {
                 const queue = JSON.parse(str);
                 const newQ = queue.filter((q: any) => q.id !== id);
                 localStorage.setItem('offline_queue_bk', JSON.stringify(newQ));
             }
             return;
        }
        await this.db.run(`DELETE FROM offline_queue WHERE id = ?`, [id]);
    }
}

export const databaseService = new DatabaseService();
