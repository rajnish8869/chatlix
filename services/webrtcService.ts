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
    
    constructor() {}
    
    async setupLocalMedia(video: boolean = false): Promise<MediaStream> {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Media devices API not supported");
        }

        try {
            // 1. Try with preferred constraints
            // On some Android WebViews, specific facingMode or constraints can cause OverconstrainedError or general DOMException
            const stream = await navigator.mediaDevices.getUserMedia({
                video: video ? { 
                    facingMode: 'user',
                    // Optional: Add ideal resolution to prevent fetching 4k streams on low-end devices
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } : false,
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            this.localStream = stream;
            return stream;
        } catch(e: any) {
            console.warn("Preferred media constraints failed, retrying with defaults...", e.name, e.message);
            
            // 2. Fallback to basic constraints (often fixes OverconstrainedError)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: video ? true : false,
                    audio: true
                });
                this.localStream = stream;
                return stream;
            } catch (err: any) {
                console.error("Error accessing media devices.", err.name, err.message);
                throw err;
            }
        }
    }

    createPeerConnection(onTrack: (stream: MediaStream) => void) {
        this.peerConnection = new RTCPeerConnection(servers);
        this.remoteStream = new MediaStream();

        this.localStream?.getTracks().forEach((track) => {
            if (this.peerConnection && this.localStream) {
                this.peerConnection.addTrack(track, this.localStream);
            }
        });

        this.peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                this.remoteStream?.addTrack(track);
            });
            onTrack(this.remoteStream!);
        };
        
        return this.peerConnection;
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
        onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!this.peerConnection?.currentRemoteDescription && data?.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                this.peerConnection.setRemoteDescription(answerDescription);
            }
        });

        // Listen for Remote Candidates
        onSnapshot(candidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                     const data = change.doc.data();
                     if (data.type === 'callee' && this.peerConnection) {
                         const candidate = new RTCIceCandidate(data.candidate);
                         this.peerConnection.addIceCandidate(candidate);
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
        onSnapshot(candidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                     const data = change.doc.data();
                     if (data.type === 'caller' && this.peerConnection) {
                         const candidate = new RTCIceCandidate(data.candidate);
                         this.peerConnection.addIceCandidate(candidate);
                     }
                }
            });
        });
    }

    async cleanup(callId: string | null) {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.remoteStream = null;

        if (callId) {
             try {
                 const callRef = doc(db, 'calls', callId);
                 const snap = await getDoc(callRef);
                 if (snap.exists()) {
                     const data = snap.data();
                     // If call isn't already marked as ended/rejected, close it and calc duration
                     if (data.status !== 'ended' && data.status !== 'rejected') {
                         const endedAt = Date.now();
                         let duration = 0;
                         if (data.status === 'connected') {
                             duration = Math.floor((endedAt - data.timestamp) / 1000);
                         }
                         await updateDoc(callRef, { 
                             status: 'ended',
                             endedAt,
                             duration
                         });
                     } else if (!data.endedAt) {
                         // Update endedAt if missing
                         await updateDoc(callRef, { endedAt: Date.now() });
                     }
                 }
             } catch(e) {
                 // ignore
             }
        }
    }
}

export const webRTCService = new WebRTCService();