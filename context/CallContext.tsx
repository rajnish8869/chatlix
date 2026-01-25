import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { CallSession } from '../types';
import { webRTCService } from '../services/webrtcService';
import { CallOverlay } from '../components/CallOverlay';

interface CallContextType {
    callStatus: 'idle' | 'incoming' | 'outgoing' | 'connected' | 'reconnecting';
    activeCall: CallSession | null;
    incomingCall: CallSession | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    startCall: (calleeId: string, type: 'audio' | 'video') => Promise<void>;
    acceptCall: () => Promise<void>;
    rejectCall: () => Promise<void>;
    endCall: () => Promise<void>;
    toggleMute: () => void;
    toggleVideo: () => void;
    flipCamera: () => void;
    isMuted: boolean;
    isVideoOff: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [callStatus, setCallStatus] = useState<'idle' | 'incoming' | 'outgoing' | 'connected' | 'reconnecting'>('idle');
    const [activeCall, setActiveCall] = useState<CallSession | null>(null);
    const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
    
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    
    const callTimeoutRef = useRef<any>(null);

    // Listen for incoming calls
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'calls'),
            where('calleeId', '==', user.user_id),
            where('status', '==', 'offering')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data() as any;
                    // Ignore stale calls (> 45s) to prevent ghosts
                    if (Date.now() - data.timestamp > 45000) return;

                    // EDGE CASE: Glare / Collision Handling
                    // If we are currently making an outgoing call to the same person who is calling us...
                    if (callStatus === 'outgoing' && activeCall?.calleeId === data.callerId) {
                        console.log("[CallContext] Glare detected. Resolving collision...");
                        
                        // ID comparison to decide who yields.
                        // If My ID < Their ID, I yield (cancel my outgoing, accept their incoming state).
                        // If My ID > Their ID, I persist (they will yield).
                        if (user.user_id < data.callerId) {
                            console.log("[CallContext] Yielding to incoming call.");
                            // Cancel my outgoing call without closing the service completely yet
                             webRTCService.cleanup(activeCall.call_id).then(() => {
                                 setActiveCall(null);
                                 setIncomingCall({ ...data, call_id: change.doc.id });
                                 setCallStatus('incoming');
                             });
                        } else {
                            console.log("[CallContext] Persisting outgoing call. Ignoring incoming collision.");
                            // We ignore this incoming packet. The other side will cancel theirs and see ours.
                        }
                        return;
                    }

                    if (callStatus === 'idle') {
                        setIncomingCall({ ...data, call_id: change.doc.id });
                        setCallStatus('incoming');
                    }
                }
            });
        }, (error) => {
            console.error("Error listening for incoming calls:", error);
        });

        return () => unsubscribe();
    }, [user, callStatus, activeCall]);

    // Cleanup on unmount or logout
    useEffect(() => {
        if (!user) {
            webRTCService.cleanup(null);
            setCallStatus('idle');
            setIncomingCall(null);
            setActiveCall(null);
        }
    }, [user]);

    const handleConnectionStateChange = (state: string) => {
        if (state === 'disconnected' || state === 'failed') {
            setCallStatus('reconnecting');
        } else if (state === 'connected' || state === 'completed') {
            setCallStatus('connected');
        } else if (state === 'closed') {
            endCall(false);
        }
    };

    const startCall = async (calleeId: string, type: 'audio' | 'video') => {
        if (!user) return;
        
        try {
            // Check for recursive fallback in service
            let stream: MediaStream;
            try {
                stream = await webRTCService.setupLocalMedia(type === 'video');
            } catch (mediaErr: any) {
                if (mediaErr.message === "VIDEO_FAILED_AUDIO_OK") {
                    // Fallback to audio call if video failed
                    type = 'audio';
                    stream = webRTCService.localStream!;
                    alert("Camera unavailable. Switching to Audio call.");
                } else {
                    throw mediaErr;
                }
            }

            setLocalStream(stream);
            setCallStatus('outgoing');

            webRTCService.createPeerConnection((remote) => {
                setRemoteStream(remote);
            }, handleConnectionStateChange);

            const callId = await webRTCService.createCall(user.user_id, calleeId, type);
            
            const newCall: CallSession = {
                call_id: callId,
                callerId: user.user_id,
                calleeId,
                type,
                status: 'offering',
                timestamp: Date.now()
            };
            setActiveCall(newCall);

            // Timeout: If not answered in 45s, end it.
            if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = setTimeout(() => {
                if (callStatus === 'outgoing') {
                    console.log("[CallContext] Call timed out.");
                    endCall(true);
                    alert("No answer.");
                }
            }, 45000);

            // Listen for answer/end
            const unsub = onSnapshot(doc(db, 'calls', callId), (snap) => {
                const data = snap.data();
                if (data?.status === 'connected') {
                    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
                    setCallStatus('connected');
                } else if (data?.status === 'ended' || data?.status === 'rejected') {
                    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
                    endCall(false); // don't update db again, already ended
                    if (data?.status === 'rejected') alert("Call rejected.");
                }
            });
            
        } catch (e: any) {
            console.error("Failed to start call", e);
            setCallStatus('idle');
            setLocalStream(null);
            
            let msg = "Could not start call.";
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                msg = "Permission denied. Please allow camera/microphone access.";
            } else if (e.name === 'NotFoundError') {
                msg = "No camera or microphone found.";
            } else if (e.name === 'NotReadableError') {
                msg = "Hardware error: Camera/Mic might be in use by another app.";
            } else if (e.name === 'OverconstrainedError') {
                msg = "Camera does not support the requested quality.";
            }
            
            alert(msg);
        }
    };

    const acceptCall = async () => {
        if (!incomingCall || !user) return;
        
        try {
            const stream = await webRTCService.setupLocalMedia(incomingCall.type === 'video');
            setLocalStream(stream);

            webRTCService.createPeerConnection((remote) => {
                setRemoteStream(remote);
            }, handleConnectionStateChange);

            await webRTCService.answerCall(incomingCall.call_id);
            setActiveCall(incomingCall);
            setIncomingCall(null);
            setCallStatus('connected');

            // Listen for end
            onSnapshot(doc(db, 'calls', incomingCall.call_id), (snap) => {
                const data = snap.data();
                if (data?.status === 'ended') {
                    endCall(false);
                }
            }, (error) => {
                console.error("Error listening to active call:", error);
            });
            
        } catch (e) {
            console.error("Failed to accept call", e);
            endCall();
        }
    };

    const rejectCall = async () => {
        if (!incomingCall) return;
        try {
            await updateDoc(doc(db, 'calls', incomingCall.call_id), { status: 'rejected' });
        } catch(e) {}
        setIncomingCall(null);
        setCallStatus('idle');
    };

    const endCall = async (updateDb: boolean = true) => {
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        
        const id = activeCall?.call_id || incomingCall?.call_id;
        
        if (id && updateDb) {
            await webRTCService.cleanup(id);
        } else {
            await webRTCService.cleanup(null);
        }

        setCallStatus('idle');
        setActiveCall(null);
        setIncomingCall(null);
        setLocalStream(null);
        setRemoteStream(null);
        setIsMuted(false);
        setIsVideoOff(false);
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    const flipCamera = async () => {
        // Simple implementation: stop current video track, get new one with opposite facing mode
        if (webRTCService.peerConnection && localStream) {
            const currentTrack = localStream.getVideoTracks()[0];
            if (!currentTrack) return;
            
            const currentMode = currentTrack.getSettings().facingMode;
            const newMode = currentMode === 'user' ? 'environment' : 'user';
            
            currentTrack.stop();
            
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode }});
                const newTrack = newStream.getVideoTracks()[0];
                
                const sender = webRTCService.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newTrack);
                    localStream.removeTrack(currentTrack);
                    localStream.addTrack(newTrack);
                    // Force update state to re-render local video
                    setLocalStream(new MediaStream(localStream.getTracks())); 
                }
            } catch (e) {
                console.error("Failed to flip camera", e);
                // If failed, try to restore original
                alert("Could not switch camera.");
            }
        }
    };

    return (
        <CallContext.Provider value={{
            callStatus,
            activeCall,
            incomingCall,
            localStream,
            remoteStream,
            startCall,
            acceptCall,
            rejectCall,
            endCall,
            toggleMute,
            toggleVideo,
            flipCamera,
            isMuted,
            isVideoOff
        }}>
            {children}
            <CallOverlay />
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within CallProvider');
    return context;
};