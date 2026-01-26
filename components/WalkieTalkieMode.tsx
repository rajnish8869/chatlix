
import React, { useState, useEffect } from 'react';
import { usePTT } from '../context/PTTContext';
import { useCall } from '../context/CallContext';
import { Avatar, Icons } from './AndroidUI';
import { useData } from '../context/DataContext';

export const WalkieTalkieMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { 
        isPTTActive, 
        isTalking, 
        isReceiving, 
        isMicLocked, 
        pressToTalk, 
        releaseTalk, 
        toggleMicLock, 
        trustUser,
        untrustUser
    } = usePTT();
    
    const { activeCall, endCall, callStatus } = useCall();
    const { contacts } = useData();
    const [dragY, setDragY] = useState(0);
    const startYRef = React.useRef<number | null>(null);

    // Show only if active call exists and is PTT type
    if (!activeCall || activeCall.type !== 'ptt') return null;

    const contact = contacts.find(c => c.user_id === activeCall.calleeId || c.user_id === activeCall.callerId);
    
    // Handlers for PTT Button
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
        
        // Lock threshold (swipe up)
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

    const getStatusText = () => {
        if (callStatus === 'connected') {
            if (isReceiving) return "RECEIVING...";
            if (isTalking) return "TRANSMITTING...";
            return "STANDBY";
        }
        return "CONNECTING...";
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col items-center justify-between py-12 px-6 overflow-hidden">
            {/* Background Pulse Effect when receiving */}
            {isReceiving && (
                <div className="absolute inset-0 bg-primary/20 animate-pulse pointer-events-none" />
            )}

            {/* Header */}
            <div className="w-full flex justify-between items-start z-10">
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full">
                    <Icons.ChevronDown className="w-6 h-6 rotate-90" />
                </button>
                <div className="flex flex-col items-center">
                    <Avatar 
                        name={contact?.username || "Unknown"} 
                        src={contact?.profile_picture} 
                        size="xl" 
                        className={`border-4 ${isReceiving ? 'border-primary shadow-glow' : 'border-white/10'}`}
                    />
                    <h2 className="mt-4 text-2xl font-black tracking-tight">{contact?.username}</h2>
                    <span className={`text-sm font-bold tracking-widest uppercase ${isReceiving ? 'text-primary animate-pulse' : 'text-white/40'}`}>
                        {getStatusText()}
                    </span>
                </div>
                <button onClick={() => endCall()} className="p-2 bg-danger/20 text-danger rounded-full">
                    <Icons.Close className="w-6 h-6" />
                </button>
            </div>

            {/* Visualizer / Status Area */}
            <div className="flex-1 flex items-center justify-center w-full">
                {isTalking && (
                    <div className="flex items-center gap-1 h-12">
                         {[...Array(5)].map((_, i) => (
                             <div key={i} className="w-2 bg-primary rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: `${i * 0.1}s`, height: '100%' }} />
                         ))}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="relative w-full flex flex-col items-center pb-8 z-10">
                
                {/* Lock Indicator */}
                <div className={`flex flex-col items-center gap-2 mb-8 transition-all duration-300 ${dragY > 50 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <Icons.Lock className="w-6 h-6 text-white" />
                    <span className="text-xs font-bold uppercase tracking-widest">Swipe up to Lock</span>
                </div>

                {isMicLocked ? (
                    <button 
                        onClick={toggleMicLock}
                        className="w-48 h-48 rounded-full bg-primary flex flex-col items-center justify-center shadow-[0_0_50px_rgba(var(--primary-color),0.4)] animate-pulse"
                    >
                        <Icons.Lock className="w-12 h-12 text-white mb-2" />
                        <span className="text-sm font-bold">LOCKED ON</span>
                        <span className="text-xs opacity-70 mt-1">Tap to Unlock</span>
                    </button>
                ) : (
                    <div 
                        className={`relative ${!isPTTActive ? 'opacity-50 grayscale pointer-events-none' : ''}`}
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
                            className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-1 bg-white/20 rounded-full"
                            style={{ height: Math.min(dragY, 150), bottom: '50%' }}
                        />

                        <button 
                            className={`
                                w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-100
                                ${isTalking ? 'bg-primary scale-95 shadow-[0_0_30px_rgba(var(--primary-color),0.6)]' : 'bg-surface-highlight border-4 border-white/10'}
                            `}
                            style={{ transform: `translateY(${-Math.min(dragY, 100)}px)` }}
                        >
                            <div className={`p-4 rounded-full ${isTalking ? 'bg-white/20' : 'bg-white/5'}`}>
                                <Icons.Mic className="w-12 h-12 text-white" />
                            </div>
                            <span className="text-sm font-bold mt-2 text-white/80">HOLD TO TALK</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
