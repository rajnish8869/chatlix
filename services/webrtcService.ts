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
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: video ? { facingMode: 'user' } : false,
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            this.localStream = stream;
            return stream;
        } catch(e) {
            console.error("Error accessing media devices.", e);
            throw e;
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
             // In a real app, use a Cloud Function or separate cleanup logic
             // to avoid permissions issues if the other user already deleted it.
             try {
                 await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
             } catch(e) {
                 // ignore
             }
        }
    }
}

export const webRTCService = new WebRTCService();