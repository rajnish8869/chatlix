const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Triggered when a new message is created in a chat.
 * Sends a "Data Message" (Wake and Decrypt) to all participants except the sender.
 */
exports.notifyNewMessage = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const newMessage = snap.data();
        const chatId = context.params.chatId;
        const senderId = newMessage.sender_id;

        // 1. Get Chat details (participants)
        const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
        if (!chatDoc.exists) return null;
        
        const chatData = chatDoc.data();
        const participants = chatData.participants || [];

        // 2. Filter recipients (everyone except sender)
        const recipientIds = participants.filter(uid => uid !== senderId);
        if (recipientIds.length === 0) return null;

        // 3. Get Sender Info (for Notification Title)
        const senderDoc = await admin.firestore().collection('users').doc(senderId).get();
        const senderName = senderDoc.exists ? senderDoc.data().username : "Someone";

        // 4. Fetch FCM Tokens for recipients
        const tokensToNotify = [];
        
        // We use a Promise.all to fetch all user docs in parallel
        const userDocsPromises = recipientIds.map(uid => admin.firestore().collection('users').doc(uid).get());
        const userDocs = await Promise.all(userDocsPromises);

        userDocs.forEach(doc => {
            if (doc.exists) {
                const userData = doc.data();
                if (userData.fcm_tokens && Array.isArray(userData.fcm_tokens)) {
                    tokensToNotify.push(...userData.fcm_tokens);
                }
            }
        });

        if (tokensToNotify.length === 0) {
            console.log('No tokens found for recipients.');
            return null;
        }

        // 5. Construct Payload (Data Message ONLY)
        // We do NOT use 'notification' key to prevent OS from showing a default message.
        // The client must wake up, decrypt 'encryptedBody', and show a local notification.
        const payload = {
            data: {
                type: 'NEW_MESSAGE',
                chatId: chatId,
                msgId: context.params.messageId,
                senderId: senderId,
                senderName: senderName,
                msgType: newMessage.type,
                // The encrypted string. The server CANNOT read this.
                encryptedBody: newMessage.type === 'text' || newMessage.type === 'encrypted' ? newMessage.message : ''
            }
        };

        // 6. Send to all tokens
        // Check if there are too many tokens (multicast limit is 500)
        // For production apps, batching is required.
        const response = await admin.messaging().sendToDevice(tokensToNotify, payload, {
            priority: 'high',
            contentAvailable: true // Critical for iOS background wake
        });

        // 7. Cleanup invalid tokens
        const tokensToRemove = [];
        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error('Failure sending notification to', tokensToNotify[index], error);
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    tokensToRemove.push(tokensToNotify[index]);
                }
            }
        });
        
        // Note: Actual token removal from Firestore requires mapping token back to user ID.
        // Omitted for brevity in this snippet.
        
        return null;
    });
