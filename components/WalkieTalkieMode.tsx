
import React, { useState, useEffect, useRef } from 'react';
import { usePTT } from '../context/PTTContext';
import { useCall } from '../context/CallContext';
import { Avatar, Icons } from './AndroidUI';
import { useData } from '../context/DataContext';

export const WalkieTalkieMode: React.FC = () => {
    const { 
        isPTTActive, 
        isTalking, 
        isReceiving, 
        isMicLocked, 
        pressToTalk, 
        releaseTalk, 
        toggleMicLock,
        trustUser
    } = usePTT();
    
    const { activeCall, incomingCall, acceptCall, rejectCall, endCall, callStatus } = useCall();
    const { contacts } = useData();
    const [dragY, setDragY] = useState(0);
    const startYRef = useRef<number | null>(null);

    // 1. Determine if we should show anything
    // Show if we have an active PTT session OR an incoming PTT request
    const showActive = activeCall && activeCall.type === 'ptt';
    const showIncoming = incomingCall && incomingCall.type === 'ptt';

    if (!showActive && !showIncoming) return null;

    // 2. Resolve Contact Info
    const targetId = showActive 
        ? (activeCall?.callerId === activeCall?.calleeId ? activeCall?.calleeId : (activeCall?.callerId === contacts.find(c => c.user_id === activeCall?.callerId)?.user_id ? activeCall?.calleeId : activeCall?.callerId)) // Simplified logic below
        : incomingCall?.callerId;
    
    // Better logic to find the "Other" person
    const session = activeCall || incomingCall;
    const contactId = session?.callerId === contacts.find(c => c.user_id === session?.callerId)?.user_id 
        ? session?.callerId 
        : session?.calleeId; // This logic is slightly flawed in generic context, let's fix:
    
    // Robust Peer ID finding
    // If Incoming: Peer is Caller.
    // If Active: Peer is the one who isn't 'Me' (but we don't have 'Me' in this scope easily without auth). 
    // However, contacts lookup usually works by ID.
    const peerId = showIncoming ? incomingCall?.callerId : (activeCall?.callerId === contacts.find(c => c.user_id === activeCall?.callerId)?.user_id ? activeCall?.callerId : activeCall?.calleeId); 
    
    // Actually, simple way: We need to find the user object for the person on the OTHER end.
    // Since we don't have 'currentUser' here easily, we rely on the fact that 'contacts' usually excludes 'me'.
    // Or we just look up both IDs in contacts.
    
    let contact = contacts.find(c => c.user_id === session?.callerId) || contacts.find(c => c.user_id === session?.calleeId);
    
    // Fallback if contact not found (e.g. not in list)
    const displayName = contact?.username || "Unknown User";
    const displayImage = contact?.profile_picture;

    // --- HANDLERS ---

    const handleAccept = async () => {
        if (incomingCall) {
            // Optional: Add logic here to prompt "Always allow this user?"
            // For now, we trust them for this session implicitly by accepting.
            // await trustUser(incomingCall.callerId); 
            await acceptCall();
        }
    };

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (isMicLocked || !isPTTActive) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        startYRef.current = clientY;
        pressToTalk();
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isTalking || isMicLocked || startYRef.current === null || !isPTTActive) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const diff = startYRef.current - clientY;
        if (diff > 0) setDragY(diff);
        
        if (diff > 120) {
            toggleMicLock();
            startYRef.current = null;
            setDragY(0);
        }
    };

    const handleTouchEnd = () => {
        if (startYRef.current !== null) {
            releaseTalk();
            startYRef.current = null;
            setDragY(0);
        }
    };

    // --- INCOMING REQUEST UI ---
    if (showIncoming) {
        return (
            <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl text-white flex flex-col items-center justify-center animate-fade-in">
                <div className="absolute inset-0 bg-primary/20 animate-pulse pointer-events-none" />
                
                <div className="z-10 flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/40 rounded-full animate-ping blur-md" />
                        <Avatar 
                            name={displayName} 
                            src={displayImage} 
                            size="2xl" 
                            className="border-4 border-primary shadow-2xl relative z-10"
                        />
                    </div>
                    
                    <div className="text-center space-y-1">
                        <h2 className="text-3xl font-black tracking-tight">{displayName}</h2>
                        <div className="flex items-center justify-center gap-2 text-primary font-bold tracking-widest uppercase text-sm">
                            <Icons.Walkie className="w-4 h-4" />
                            <span>Walkie Talkie Request</span>
                        </div>
                    </div>

                    <div className="flex gap-6 mt-8">
                        <button 
                            onClick={() => rejectCall()}
                            className="w-16 h-16 rounded-full bg-surface border border-white/10 text-danger flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            <Icons.Close className="w-8 h-8" />
                        </button>
                        
                        <button 
                            onClick={handleAccept}
                            className="h-16 px-8 rounded-full bg-primary text-white font-bold tracking-wide shadow-[0_0_30px_rgba(var(--primary-color),0.5)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                        >
                            <Icons.Mic className="w-6 h-6" />
                            <span>ACCEPT</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- ACTIVE SESSION UI ---
    const getStatusText = () => {
        if (callStatus === 'connected') {
            if (isReceiving) return "RECEIVING...";
            if (isTalking) return "TRANSMITTING...";
            return "CHANNEL OPEN";
        }
        return "CONNECTING...";
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col items-center justify-between py-12 px-6 overflow-hidden animate-slide-up">
            {/* Receiving Visual */}
            {isReceiving && (
                <div className="absolute inset-0 bg-primary/20 animate-pulse pointer-events-none" />
            )}

            {/* Header */}
            <div className="w-full flex justify-between items-start z-10">
                <div /> {/* Spacer for centering */}
                
                <div className="flex flex-col items-center mt-4">
                    <Avatar 
                        name={displayName} 
                        src={displayImage} 
                        size="xl" 
                        className={`border-4 transition-all duration-300 ${isReceiving ? 'border-primary shadow-[0_0_30px_rgba(var(--primary-color),0.6)] scale-110' : 'border-white/10'}`}
                    />
                    <h2 className="mt-4 text-2xl font-black tracking-tight">{displayName}</h2>
                    <span className={`text-sm font-bold tracking-widest uppercase transition-colors ${isReceiving ? 'text-primary' : isTalking ? 'text-red-500' : 'text-white/40'}`}>
                        {getStatusText()}
                    </span>
                </div>

                <button onClick={() => endCall()} className="p-3 bg-white/10 hover:bg-danger/20 hover:text-danger text-white rounded-full transition-colors backdrop-blur-md">
                    <Icons.Close className="w-6 h-6" />
                </button>
            </div>

            {/* Visualizer Area */}
            <div className="flex-1 flex items-center justify-center w-full">
                {isTalking && (
                    <div className="flex items-center gap-1.5 h-16">
                         {[...Array(7)].map((_, i) => (
                             <div 
                                key={i} 
                                className="w-2 bg-red-500 rounded-full animate-[bounce_0.8s_infinite]" 
                                style={{ animationDelay: `${i * 0.1}s`, height: `${60 + Math.random() * 40}%` }} 
                             />
                         ))}
                    </div>
                )}
                {isReceiving && (
                    <div className="flex items-center gap-1.5 h-16">
                         {[...Array(7)].map((_, i) => (
                             <div 
                                key={i} 
                                className="w-2 bg-primary rounded-full animate-[bounce_0.8s_infinite]" 
                                style={{ animationDelay: `${i * 0.1}s`, height: `${60 + Math.random() * 40}%` }} 
                             />
                         ))}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="relative w-full flex flex-col items-center pb-12 z-10">
                
                {/* Lock Indicator */}
                <div className={`flex flex-col items-center gap-2 mb-8 transition-all duration-300 ${dragY > 50 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <Icons.Lock className="w-5 h-5 text-white" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Swipe up to Lock</span>
                </div>

                {isMicLocked ? (
                    <button 
                        onClick={toggleMicLock}
                        className="w-48 h-48 rounded-full bg-red-500 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.4)] animate-pulse"
                    >
                        <Icons.Lock className="w-12 h-12 text-white mb-2" />
                        <span className="text-sm font-bold">LOCKED ON</span>
                        <span className="text-xs opacity-70 mt-1">Tap to Unlock</span>
                    </button>
                ) : (
                    <div 
                        className={`relative touch-none select-none ${callStatus !== 'connected' ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={handleTouchStart}
                        onMouseMove={handleTouchMove}
                        onMouseUp={handleTouchEnd}
                        onMouseLeave={handleTouchEnd}
                    >
                        {/* Drag Trail */}
                        <div 
                            className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-1.5 bg-white/20 rounded-full"
                            style={{ height: Math.min(dragY, 150), bottom: '50%' }}
                        />

                        <button 
                            className={`
                                w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-150 border-4
                                ${isTalking 
                                    ? 'bg-red-500 border-red-400 scale-95 shadow-[0_0_40px_rgba(239,68,68,0.6)]' 
                                    : 'bg-surface-highlight border-white/10 hover:border-white/20'
                                }
                            `}
                            style={{ transform: `translateY(${-Math.min(dragY, 100)}px)` }}
                        >
                            <div className={`p-5 rounded-full ${isTalking ? 'bg-black/20' : 'bg-black/10'}`}>
                                <Icons.Mic className="w-14 h-14 text-white" />
                            </div>
                            <span className="text-sm font-bold mt-3 text-white/80 tracking-wide">
                                {isTalking ? "RELEASE TO SEND" : "HOLD TO TALK"}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
