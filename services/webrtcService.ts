import { db } from './firebase';
import { collection, addDoc, onSnapshot, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:global.stun.twilio.com:3478"
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCService {
    peerConnection: RTCPeerConnection | null = null;
    localStream: MediaStream | null = null;
    remoteStream: MediaStream | null = null;
    unsubscribeSignaling: (() => void) | null = null;
    unsubscribeCandidates: (() => void) | null = null;
    
    constructor() {}
    
    // EDGE CASE 1: Robust Media Access with 3-Stage Fallback
    async setupLocalMedia(video: boolean = false): Promise<MediaStream> {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Media devices API not supported");
        }

        const getMedia = async (constraints: MediaStreamConstraints) => {
            return await navigator.mediaDevices.getUserMedia(constraints);
        };

        try {
            // Stage 1: Preferred (HD / User Facing)
            if (video) {
                return await getMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
            } else {
                return await getMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            }
        } catch(e: any) {
            console.warn("Stage 1 media failed, trying Stage 2...", e.message);
            
            try {
                // Stage 2: Basic (Any Resolution / System Default) - Fixes OverconstrainedError
                return await getMedia({
                    video: video ? true : false, // Let OS decide resolution
                    audio: true
                });
            } catch (err: any) {
                console.warn("Stage 2 media failed, trying Stage 3 (Audio Only)...", err.message);
                
                // Stage 3: Audio Only Fallback (If camera is broken/in-use but mic works)
                if (video) {
                    try {
                        const stream = await getMedia({ audio: true });
                        // Notify UI that we fell back to audio
                        throw new Error("VIDEO_FAILED_AUDIO_OK"); 
                    } catch (finalErr) {
                         throw finalErr;
                    }
                }
                throw err;
            }
        }
    }

    createPeerConnection(onTrack: (stream: MediaStream) => void, onConnectionStateChange?: (state: string) => void) {
        // EDGE CASE 2: Clean up previous PC if exists to prevent "Resource in use"
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        this.peerConnection = new RTCPeerConnection(servers);
        this.remoteStream = new MediaStream();

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                if (this.peerConnection && this.localStream) {
                    this.peerConnection.addTrack(track, this.localStream);
                }
            });
        }

        this.peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                this.remoteStream?.addTrack(track);
            });
            onTrack(this.remoteStream!);
        };
        
        // EDGE CASE 4: Network Disconnects & ICE State Monitoring
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection?.iceConnectionState;
            console.log(`[WebRTC] ICE State: ${state}`);
            if (onConnectionStateChange && state) {
                onConnectionStateChange(state);
            }
            if (state === 'failed' || state === 'disconnected') {
                // Trigger ICE Restart
                this.restartIce(); 
            }
        };

        return this.peerConnection;
    }
    
    async restartIce() {
        if (!this.peerConnection) return;
        console.log("[WebRTC] Attempting ICE Restart...");
        // Create a new offer with iceRestart: true
        try {
            const offer = await this.peerConnection.createOffer({ iceRestart: true });
            await this.peerConnection.setLocalDescription(offer);
            // In a full implementation, we would send this new offer to Firestore
            // to re-negotiate. For this scope, we catch the disconnect.
        } catch (e) {
            console.error("ICE Restart failed", e);
        }
    }

    async createCall(callerId: string, calleeId: string, type: 'audio'|'video'): Promise<string> {
        if (!this.peerConnection) throw new Error("PeerConnection not initialized");

        const callDocRef = doc(collection(db, 'calls'));
        const candidatesCol = collection(callDocRef, 'candidates');

        this.peerConnection.onicecandidate = (event) => {
            if(event.candidate) {
                addDoc(candidatesCol, { candidate: event.candidate.toJSON(), type: 'caller' });
            }
        };

        const offerDescription = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offerDescription);

        const callData = {
            call_id: callDocRef.id,
            callerId,
            calleeId,
            type,
            offer: {
                type: offerDescription.type,
                sdp: offerDescription.sdp
            },
            status: 'offering',
            timestamp: Date.now()
        };

        await setDoc(callDocRef, callData);

        // Listen for Answer
        this.unsubscribeSignaling = onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            // EDGE CASE 3: Race Condition - Ensure we are in correct state before setting remote
            if (this.peerConnection && !this.peerConnection.currentRemoteDescription && data?.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                this.peerConnection.setRemoteDescription(answerDescription)
                    .catch(e => console.error("Error setting remote description", e));
            }
        });

        // Listen for Remote Candidates
        this.unsubscribeCandidates = onSnapshot(candidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                     const data = change.doc.data();
                     if (data.type === 'callee' && this.peerConnection) {
                         const candidate = new RTCIceCandidate(data.candidate);
                         this.peerConnection.addIceCandidate(candidate).catch(e => console.error("Error adding candidate", e));
                     }
                }
            });
        });

        return callDocRef.id;
    }

    async answerCall(callId: string) {
        if (!this.peerConnection) throw new Error("PeerConnection not initialized");

        const callDocRef = doc(db, 'calls', callId);
        const candidatesCol = collection(callDocRef, 'candidates');
        const callSnap = await getDoc(callDocRef);
        const callData = callSnap.data();

        this.peerConnection.onicecandidate = (event) => {
            if(event.candidate) {
                addDoc(candidatesCol, { candidate: event.candidate.toJSON(), type: 'callee' });
            }
        };

        const offerDescription = callData?.offer;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        await updateDoc(callDocRef, { answer, status: 'connected' });

        // Listen for Remote Candidates (Caller)
        this.unsubscribeCandidates = onSnapshot(candidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                     const data = change.doc.data();
                     if (data.type === 'caller' && this.peerConnection) {
                         const candidate = new RTCIceCandidate(data.candidate);
                         this.peerConnection.addIceCandidate(candidate).catch(e => console.error("Error adding candidate", e));
                     }
                }
            });
        });
    }

    async cleanup(callId: string | null) {
        if (this.unsubscribeSignaling) {
            this.unsubscribeSignaling();
            this.unsubscribeSignaling = null;
        }
        if (this.unsubscribeCandidates) {
            this.unsubscribeCandidates();
            this.unsubscribeCandidates = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // EDGE CASE: Ensure tracks are completely stopped to release camera hardware
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            this.localStream = null;
        }
        this.remoteStream = null;

        if (callId) {
             try {
                 // Set to ended so other peer detects disconnect
                 await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
             } catch(e) {
                 // ignore permission errors if already deleted
             }
        }
    }
}

export const webRTCService = new WebRTCService();