import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { db, auth } from './firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// In production, this might need to be a full URL if your Capacitor app
// isn't proxied to Vercel (e.g. https://your-app.vercel.app/api/notify)
// We use a relative path assuming web or properly configured native request interception,
// otherwise fall back to the env var.
const API_URL = ((import.meta as any).env?.VITE_API_URL || '') + '/api/notify';

export const notificationService = {
    init: async (userId: string) => {
        if (!Capacitor.isNativePlatform()) {
            console.log("Web platform: Push Notifications skipped");
            return;
        }

        try {
            const permStatus = await PushNotifications.checkPermissions();
            
            if (permStatus.receive === 'prompt') {
                const newStatus = await PushNotifications.requestPermissions();
                if (newStatus.receive !== 'granted') {
                    throw new Error('User denied permissions!');
                }
            } else if (permStatus.receive !== 'granted') {
                throw new Error('User denied permissions!');
            }

            await PushNotifications.register();

            PushNotifications.addListener('registration', async (token) => {
                console.log('Push Registration Success. Token:', token.value);
                await notificationService.saveTokenToProfile(userId, token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push Registration Error: ', error);
            });

            // Create notification channel for Android (High Importance)
            await PushNotifications.createChannel({
                id: 'messages',
                name: 'Messages',
                description: 'Notifications for new messages',
                importance: 5,
                visibility: 1,
                vibration: true,
            });

        } catch (e) {
            console.error('Failed to init push notifications', e);
        }
    },

    saveTokenToProfile: async (userId: string, token: string) => {
        if (!userId || !token) return;
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                fcm_tokens: arrayUnion(token)
            });
        } catch (e) {
            console.error("Error saving FCM token", e);
        }
    },

    triggerNotification: async (
        recipientId: string, 
        chatId: string, 
        senderName: string,
        isEncrypted: boolean = true
    ) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // Don't await this, fire and forget to keep UI snappy
        currentUser.getIdToken().then(async (token) => {
            try {
                await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        recipientId,
                        chatId,
                        title: senderName,
                        body: isEncrypted ? 'New Encrypted Message' : 'New Message',
                        senderName
                    })
                });
            } catch (e) {
                console.error("Failed to trigger notification", e);
            }
        });
    }
};