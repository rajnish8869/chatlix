
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useCall } from './CallContext';
import { useAuth } from './AuthContext';
import { webRTCService } from '../services/webrtcService';
import { chatService } from '../services/chatService';

interface PTTContextType {
    isPTTActive: boolean;
    isTalking: boolean;
    isReceiving: boolean;
    isMicLocked: boolean;
    startSession: (targetUserId: string) => Promise<void>;
    pressToTalk: () => void;
    releaseTalk: () => void;
    toggleMicLock: () => void;
    trustUser: (targetUserId: string) => Promise<void>;
    untrustUser: (targetUserId: string) => Promise<void>;
}

const PTTContext = createContext<PTTContextType | undefined>(undefined);

export const PTTProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { startCall, activeCall, callStatus, remoteStream } = useCall();
    const { user } = useAuth();
    
    const [isTalking, setIsTalking] = useState(false);
    const [isReceiving, setIsReceiving] = useState(false);
    const [isMicLocked, setIsMicLocked] = useState(false);
    
    // Audio Context for visualizer
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const isPTTActive = activeCall?.type === 'ptt' && callStatus === 'connected';

    // Monitor receiving audio
    useEffect(() => {
        if (isPTTActive && remoteStream) {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            
            // Ensure context is running (user gesture requirement)
            if (ctx.state === 'suspended') ctx.resume();

            const source = ctx.createMediaStreamSource(remoteStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const checkAudioLevel = () => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                
                // Simple average volume
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                
                // Threshold for "Receiving" visual
                setIsReceiving(average > 10);
                
                animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
            };
            
            checkAudioLevel();

            return () => {
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                source.disconnect();
                // Don't close context aggressively, just disconnect
            };
        } else {
            setIsReceiving(false);
        }
    }, [isPTTActive, remoteStream]);

    const startSession = async (targetUserId: string) => {
        await startCall(targetUserId, 'ptt');
    };

    const pressToTalk = () => {
        if (!isPTTActive) return;
        webRTCService.toggleAudio(true);
        setIsTalking(true);
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const releaseTalk = () => {
        if (!isPTTActive || isMicLocked) return;
        webRTCService.toggleAudio(false);
        setIsTalking(false);
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(30);
    };

    const toggleMicLock = () => {
        if (!isPTTActive) return;
        const newLockState = !isMicLocked;
        setIsMicLocked(newLockState);
        
        if (newLockState) {
            // Locked = Mic Open
            webRTCService.toggleAudio(true);
            setIsTalking(true);
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        } else {
            // Unlocked = Mic Closed (until press)
            webRTCService.toggleAudio(false);
            setIsTalking(false);
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    const trustUser = async (targetUserId: string) => {
        if (!user) return;
        await chatService.updateTrustedPTT(user.user_id, targetUserId, true);
    };

    const untrustUser = async (targetUserId: string) => {
        if (!user) return;
        await chatService.updateTrustedPTT(user.user_id, targetUserId, false);
    };

    return (
        <PTTContext.Provider value={{
            isPTTActive,
            isTalking,
            isReceiving,
            isMicLocked,
            startSession,
            pressToTalk,
            releaseTalk,
            toggleMicLock,
            trustUser,
            untrustUser
        }}>
            {children}
        </PTTContext.Provider>
    );
};

export const usePTT = () => {
    const context = useContext(PTTContext);
    if (!context) throw new Error('usePTT must be used within PTTProvider');
    return context;
};
