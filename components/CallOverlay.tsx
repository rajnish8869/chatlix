import React, { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import { Avatar, Icons, FAB } from './AndroidUI';
import { useData } from '../context/DataContext';

export const CallOverlay: React.FC = () => {
    const { 
        callStatus, 
        incomingCall, 
        activeCall, 
        localStream, 
        remoteStream, 
        acceptCall, 
        rejectCall, 
        endCall,
        toggleMute,
        toggleVideo,
        flipCamera,
        isMuted,
        isVideoOff
    } = useCall();
    
    const { contacts } = useData();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, callStatus]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, callStatus]);

    if (callStatus === 'idle') return null;

    // --- HELPER: Get User Info ---
    const getPeerInfo = (uid: string) => {
        const contact = contacts.find(c => c.user_id === uid);
        return {
            name: contact?.username || "Unknown User",
            image: contact?.profile_picture
        };
    };

    // --- INCOMING CALL UI ---
    if (callStatus === 'incoming' && incomingCall) {
        const caller = getPeerInfo(incomingCall.callerId);
        
        return (
            <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping blur-xl" />
                    <Avatar 
                        name={caller.name} 
                        src={caller.image} 
                        size="2xl" 
                        className="shadow-2xl shadow-primary/50 relative z-10"
                        showStatus={false}
                    />
                </div>
                
                <h2 className="mt-8 text-2xl font-bold text-white">{caller.name}</h2>
                <p className="text-white/70 animate-pulse">Incoming {incomingCall.type} call...</p>
                
                <div className="flex gap-8 mt-12">
                     <button 
                        onClick={rejectCall}
                        className="w-16 h-16 rounded-full bg-danger text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                     >
                         <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 rotate-[135deg]">
                             <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                         </svg>
                     </button>
                     <button 
                        onClick={acceptCall}
                        className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform animate-bounce"
                     >
                         <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                             <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                         </svg>
                     </button>
                </div>
            </div>
        );
    }

    // --- ACTIVE / OUTGOING UI ---
    if ((callStatus === 'connected' || callStatus === 'outgoing') && activeCall) {
        const isVideoCall = activeCall.type === 'video';
        
        return (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col">
                
                {/* --- Main View (Remote) --- */}
                <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                    {/* Video Stream */}
                    <video 
                        ref={remoteVideoRef} 
                        autoPlay 
                        playsInline 
                        className={`w-full h-full object-cover ${!isVideoCall || !remoteStream ? 'hidden' : ''}`}
                    />

                    {/* Fallback / Audio View */}
                    {(!isVideoCall || !remoteStream) && (
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center justify-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-white/5 rounded-full animate-pulse blur-3xl" />
                                <Avatar 
                                    name="Connected" 
                                    size="2xl" 
                                    className="scale-150 shadow-2xl" 
                                    showStatus={false} 
                                />
                            </div>
                            <h3 className="mt-12 text-2xl font-bold text-white tracking-wide">
                                {callStatus === 'outgoing' ? 'Calling...' : 'Connected'}
                            </h3>
                        </div>
                    )}

                    {/* --- Local PIP (Only if video call) --- */}
                    {isVideoCall && (
                        <div className="absolute top-12 right-4 w-32 h-48 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                            />
                            {isVideoOff && (
                                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                    <Icons.VideoOff className="text-white/50 w-8 h-8" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* --- Controls --- */}
                <div className="absolute left-0 w-full flex items-center justify-center gap-6 bottom-[calc(2.5rem+env(safe-area-inset-bottom))]">
                    <button 
                        onClick={toggleMute}
                        className={`p-4 rounded-full backdrop-blur-md transition-all ${isMuted ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}
                    >
                        {isMuted ? <Icons.MicOff className="w-6 h-6" /> : <Icons.Mic className="w-6 h-6" />}
                    </button>
                    
                    {isVideoCall && (
                        <>
                            <button 
                                onClick={toggleVideo}
                                className={`p-4 rounded-full backdrop-blur-md transition-all ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}
                            >
                                {isVideoOff ? <Icons.VideoOff className="w-6 h-6" /> : <Icons.Video className="w-6 h-6" />}
                            </button>
                            
                            <button 
                                onClick={flipCamera}
                                className="p-4 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition-all"
                            >
                                <Icons.Reset className="w-6 h-6" />
                            </button>
                        </>
                    )}

                    <button 
                        onClick={endCall}
                        className="p-4 rounded-full bg-danger text-white shadow-lg hover:scale-105 transition-transform"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 rotate-[135deg]">
                             <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    return null;
};