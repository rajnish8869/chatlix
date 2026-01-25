import React, { createContext, useContext, useEffect, useState } from 'react';
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { chatService } from '../services/chatService';

interface NotificationContextType {
    requestPermission: () => Promise<boolean>;
    hasPermission: boolean;
    testNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { decryptContent } = useData();
    const navigate = useNavigate();
    const [hasPermission, setHasPermission] = useState(false);

    // Initial check for permission status
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            PushNotifications.checkPermissions().then((res) => {
                setHasPermission(res.receive === 'granted');
            });
        }
    }, []);

    // Register listeners when user is logged in
    useEffect(() => {
        if (!user || !Capacitor.isNativePlatform()) return;

        // 1. Register for FCM
        PushNotifications.register();

        // 2. Token Listener
        const regListener = PushNotifications.addListener('registration', (token) => {
            console.log('[Notification] FCM Token:', token.value);
            chatService.saveDeviceToken(user.user_id, token.value);
        });

        const regErrorListener = PushNotifications.addListener('registrationError', (error) => {
            console.error('[Notification] Registration error:', error);
        });

        // 3. Payload Received (Wake and Decrypt)
        const msgListener = PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotificationSchema) => {
            console.log('[Notification] Received raw payload:', notification);
            
            // If app is open in foreground, we might skip showing notification 
            // because Firestore listeners already update the UI.
            // But if specific requirement allows, we can sound a chime.
            
            const data = notification.data;
            if (data?.type === 'NEW_MESSAGE' && data.encryptedBody) {
                try {
                    // WAKE AND DECRYPT STRATEGY
                    const decryptedText = await decryptContent(data.chatId, data.encryptedBody, data.senderId || '');
                    
                    const channelId = 'chat_messages';

                    await LocalNotifications.schedule({
                        notifications: [{
                            title: data.senderName || 'New Message',
                            body: data.msgType === 'image' ? '📷 Photo' : 
                                  data.msgType === 'audio' ? '🎤 Voice Message' : 
                                  decryptedText,
                            id: new Date().getTime(),
                            schedule: { at: new Date(Date.now() + 100) }, // Immediate
                            sound: 'beep.wav',
                            attachments: [],
                            actionTypeId: "",
                            extra: {
                                chatId: data.chatId
                            },
                            channelId: channelId
                        }]
                    });
                } catch (e) {
                    console.error("[Notification] Decryption failed in background", e);
                    // Fallback to generic if key unavailable
                    await LocalNotifications.schedule({
                        notifications: [{
                            title: 'New Message',
                            body: 'You have a new encrypted message',
                            id: new Date().getTime(),
                            schedule: { at: new Date(Date.now() + 100) },
                            extra: { chatId: data.chatId }
                        }]
                    });
                }
            }
        });

        // 4. Action Performed (Tap)
        const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
            const data = notification.notification.data;
            if (data?.chatId) {
                navigate(`/chat/${data.chatId}`);
            }
        });

        // 5. Local Notification Tap
        const localActionListener = LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
            const data = notification.notification.extra;
            if (data?.chatId) {
                navigate(`/chat/${data.chatId}`);
            }
        });

        // Create Channel for Android
        LocalNotifications.createChannel({
            id: 'chat_messages',
            name: 'Chat Messages',
            importance: 5,
            description: 'Notifications for new chat messages',
            sound: 'beep.wav',
            visibility: 1,
            vibration: true,
        });

        return () => {
            regListener.then(h => h.remove());
            regErrorListener.then(h => h.remove());
            msgListener.then(h => h.remove());
            actionListener.then(h => h.remove());
            localActionListener.then(h => h.remove());
        };
    }, [user, decryptContent, navigate]);

    const requestPermission = async (): Promise<boolean> => {
        if (!Capacitor.isNativePlatform()) return false;
        
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
            setHasPermission(true);
            PushNotifications.register();
            return true;
        }
        return false;
    };

    const testNotification = async () => {
        await LocalNotifications.schedule({
            notifications: [{
                title: "Test",
                body: "This is a test notification",
                id: 99999,
                schedule: { at: new Date(Date.now() + 1000) }
            }]
        });
    };

    return (
        <NotificationContext.Provider value={{ requestPermission, hasPermission, testNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error("useNotifications must be used within NotificationProvider");
    return context;
};
