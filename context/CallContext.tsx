import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { CallSession } from '../types';
import { webRTCService } from '../services/webrtcService';
import { CallOverlay } from '../components/CallOverlay';
import { notificationService } from '../services/notificationService';

interface CallContextType {
    callStatus: 'idle' | 'incoming' | 'outgoing' | 'connected';
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
    const [callStatus, setCallStatus] = useState<'idle' | 'incoming' | 'outgoing' | 'connected'>('idle');
    const [activeCall, setActiveCall] = useState<CallSession | null>(null);
    const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
    
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Refs to access latest state inside onSnapshot closures
    const incomingCallRef = useRef<CallSession | null>(null);
    const callStatusRef = useRef<string>('idle');

    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

    useEffect(() => {
        callStatusRef.current = callStatus;
    }, [callStatus]);

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
                    // Ignore old calls (> 1 min)
                    if (Date.now() - data.timestamp < 60000) {
                        const callSession = { ...data, call_id: change.doc.id };
                        setIncomingCall(callSession);
                        setCallStatus('incoming');
                    }
                }
                
                // Handle caller cancelling the call
                if (change.type === 'removed') {
                    const removedId = change.doc.id;
                    // If the removed call matches our current incoming call
                    if (incomingCallRef.current && incomingCallRef.current.call_id === removedId) {
                        // Only stop ringing if we haven't answered (status is still incoming)
                        if (callStatusRef.current === 'incoming') {
                            setIncomingCall(null);
                            setCallStatus('idle');
                        }
                    }
                }
            });
        }, (error) => {
            console.error("Error listening for incoming calls:", error);
        });

        return () => unsubscribe();
    }, [user]);

    // Cleanup on unmount or logout
    useEffect(() => {
        if (!user) {
            webRTCService.cleanup(null);
            setCallStatus('idle');
            setIncomingCall(null);
            setActiveCall(null);
        }
    }, [user]);

    const startCall = async (calleeId: string, type: 'audio' | 'video') => {
        if (!user) return;
        
        try {
            const stream = await webRTCService.setupLocalMedia(type === 'video');
            setLocalStream(stream);
            setCallStatus('outgoing');

            webRTCService.createPeerConnection((stream) => {
                setRemoteStream(stream);
            });

            const callId = await webRTCService.createCall(user.user_id, calleeId, type);
            
            // Trigger Push Notification for the call
            notificationService.triggerCallNotification(calleeId, callId, user.username, type);
            
            const newCall: CallSession = {
                call_id: callId,
                callerId: user.user_id,
                calleeId,
                type,
                status: 'offering',
                timestamp: Date.now()
            };
            setActiveCall(newCall);

            // Listen for answer/end
            const unsub = onSnapshot(doc(db, 'calls', callId), (snap) => {
                const data = snap.data();
                if (data?.status === 'connected') {
                    setCallStatus('connected');
                } else if (data?.status === 'ended' || data?.status === 'rejected') {
                    endCall(false); // don't update db again
                }
            }, (error) => {
                console.error("Error listening to call updates:", error);
                endCall(false); 
                alert("Call failed: Permission denied or connection lost.");
            });
            
        } catch (e: any) {
            console.error("Failed to start call", e);
            setCallStatus('idle');
            
            let msg = "Could not start call.";
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                msg = "Permission denied. Please allow camera/microphone access in your device settings.";
            } else if (e.name === 'NotFoundError') {
                msg = "No camera or microphone found on this device.";
            } else if (e.name === 'NotReadableError') {
                msg = "Camera/Mic is currently in use by another app.";
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

            webRTCService.createPeerConnection((stream) => {
                setRemoteStream(stream);
            });

            // Update State BEFORE async DB write to prevent "removed" listener from killing the call
            // because DB write changes status from 'offering' to 'connected'
            const activeSession = { ...incomingCall, status: 'connected' as const };
            setActiveCall(activeSession);
            setIncomingCall(null); 
            setCallStatus('connected');
            
            // Perform DB negotiation
            await webRTCService.answerCall(incomingCall.call_id);

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
        const id = activeCall?.call_id || incomingCall?.call_id;
        
        // Capture current call state before nullifying to check for missed call scenario
        const currentCall = activeCall;

        // Check if we are the caller, canceling an outgoing call that hasn't been answered yet
        if (currentCall && currentCall.callerId === user?.user_id && currentCall.status === 'offering') {
             notificationService.triggerMissedCallNotification(
                 currentCall.calleeId,
                 currentCall.call_id,
                 user.username,
                 currentCall.type
             );
        }
        
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
        if (webRTCService.peerConnection && localStream) {
            const currentTrack = localStream.getVideoTracks()[0];
            const currentMode = currentTrack.getSettings().facingMode;
            const newMode = currentMode === 'user' ? 'environment' : 'user';
            
            currentTrack.stop();
            
            const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode }});
            const newTrack = newStream.getVideoTracks()[0];
            
            const sender = webRTCService.peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(newTrack);
                localStream.removeTrack(currentTrack);
                localStream.addTrack(newTrack);
                setLocalStream(new MediaStream(localStream.getTracks())); 
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