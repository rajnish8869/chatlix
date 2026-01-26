import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// This requires the FIREBASE_SERVICE_ACCOUNT_JSON environment variable to be set in Vercel
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
    if (Object.keys(serviceAccount).length > 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
    } else {
        console.error("FIREBASE_SERVICE_ACCOUNT_JSON is missing or empty.");
    }
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", error);
  }
}

export default async function handler(req, res) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this for production security
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { recipientId, title, body, chatId, senderName, type, callId, callType } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return res.status(401).json({ error: 'Unauthorized: Missing Token' });
    }

    if (!admin.apps.length) {
       return res.status(500).json({ error: 'Server Configuration Error: Firebase Admin not initialized' });
    }

    // 1. Verify Sender
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const senderId = decodedToken.uid;

    // 2. Fetch Recipient Data
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(recipientId).get();
    
    if (!userDoc.exists) {
        return res.status(404).json({ error: 'Recipient not found' });
    }
    
    const userData = userDoc.data();
    
    // 3. Block Check
    if (userData.blocked_users && userData.blocked_users.includes(senderId)) {
        return res.status(200).json({ success: false, message: 'Blocked by user' });
    }

    const tokens = userData.fcm_tokens || [];
    if (tokens.length === 0) {
        return res.status(200).json({ success: true, message: 'No devices registered for user' });
    }

    // 4. Construct Notification
    let messagePayload;

    if (type === 'call') {
         messagePayload = {
            notification: {
                title: 'Incoming Call',
                body: `${senderName} is calling you (${callType})...`
            },
            data: {
                type: 'call',
                callId: callId || '',
                callType: callType || 'audio'
            },
            tokens: tokens,
            android: {
                priority: 'high',
                ttl: 60 * 1000, // 60 seconds expiration for calls
                notification: {
                    channelId: 'calls',
                    priority: 'high',
                    visibility: 'public',
                    sound: 'default',
                    tag: `call_${callId}` // Replacement tag
                }
            }
         };
    } else if (type === 'missed_call') {
         messagePayload = {
            notification: {
                title: 'Missed Call',
                body: `You missed a ${callType || 'audio'} call from ${senderName}`
            },
            data: {
                type: 'missed_call',
                callId: callId || '',
                chatId: chatId || '', // Optional, allows navigation to chat
            },
            tokens: tokens,
            android: {
                priority: 'high',
                notification: {
                    channelId: 'calls', 
                    priority: 'high',
                    visibility: 'public',
                    tag: `call_${callId}` // Same tag will replace the 'Incoming Call' notification
                }
            }
         };
    } else {
        // Standard Message Notification
        // Privacy: We do NOT send the message content in the push payload for E2EE chats.
        messagePayload = {
            notification: {
                title: senderName || 'Chatlix',
                body: body || 'You have a new encrypted message',
            },
            data: {
                chatId: chatId,
                type: 'message'
            },
            tokens: tokens,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'messages',
                    priority: 'high',
                    visibility: 'private'
                }
            }
        };
    }

    // 5. Send Multicast
    const response = await admin.messaging().sendEachForMulticast(messagePayload);
    
    // 6. Cleanup Invalid Tokens
    if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                failedTokens.push(tokens[idx]);
            }
        });
        
        if (failedTokens.length > 0) {
            await db.collection('users').doc(recipientId).update({
                fcm_tokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
            });
        }
    }

    return res.status(200).json({ 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
    });

  } catch (error) {
    console.error('Notification Error:', error);
    return res.status(500).json({ error: error.message });
  }
}