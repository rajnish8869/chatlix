import React, { useEffect } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
import { useChatStore } from "../store/chatStore";
import { Icons, Avatar } from "../components/AndroidUI";
import { Virtuoso } from "react-virtuoso";

const CallList: React.FC = () => {
    const { loadContacts } = useData();
    const callHistory = useChatStore(state => state.callHistory);
    const contacts = useChatStore(state => state.contacts);
    const { user } = useAuth();
    const { startCall } = useCall();

    useEffect(() => {
        loadContacts();
    }, []);

    const getPeerInfo = (callerId: string, calleeId: string) => {
        const peerId = callerId === user?.user_id ? calleeId : callerId;
        const contact = contacts.find(c => c.user_id === peerId);
        return {
            id: peerId,
            name: contact?.username || "Unknown",
            image: contact?.profile_picture,
            isOnline: contact?.status === 'online'
        };
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return "";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        
        if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
            <div className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] px-6 pb-4 glass-panel border-b border-white/5">
                <div className="h-14 flex items-center justify-between">
                    <div>
                        <h1 className="font-black text-xl tracking-tight text-text-main">
                            Calls
                        </h1>
                        <p className="text-[11px] text-text-sub opacity-60 font-medium">
                            Recent History
                        </p>
                    </div>
                </div>
            </div>

            {callHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
                        <div className="relative w-28 h-28 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl flex items-center justify-center">
                            <Icons.Phone className="w-12 h-12 text-primary/60" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-lg font-bold text-text-main">No recent calls</p>
                        <p className="text-sm text-text-sub opacity-70">
                            Your call history will appear here
                        </p>
                    </div>
                </div>
            ) : (
                <Virtuoso
                    className="flex-1 no-scrollbar"
                    data={callHistory}
                    components={{ Footer: () => <div className="h-32" /> }}
                    itemContent={(index, call) => {
                        const isOutgoing = call.callerId === user?.user_id;
                        const isMissed = !isOutgoing && (call.status === 'rejected' || (call.status === 'ended' && (!call.duration || call.duration === 0)));
                        const peer = getPeerInfo(call.callerId, call.calleeId);
                        
                        return (
                            <div className="px-3 py-2">
                                <div className="p-3.5 rounded-[24px] hover:bg-surface/40 border border-white/5 flex items-center gap-3 transition-colors">
                                    <Avatar 
                                        name={peer.name} 
                                        src={peer.image} 
                                        size="md" 
                                        online={peer.isOnline}
                                    />
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className={`truncate text-[16px] font-semibold ${isMissed ? 'text-danger' : 'text-text-main'}`}>
                                                {peer.name}
                                            </h3>
                                            <span className="text-[10px] text-text-sub font-medium opacity-60">
                                                {formatTime(call.timestamp)}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5">
                                            {isOutgoing ? (
                                                <Icons.ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                                            ) : isMissed ? (
                                                <Icons.PhoneMissed className="w-3.5 h-3.5 text-danger" />
                                            ) : (
                                                <Icons.ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />
                                            )}
                                            
                                            <span className="text-[13px] text-text-sub opacity-70 flex items-center gap-1">
                                                {isMissed ? "Missed" : isOutgoing ? "Outgoing" : "Incoming"}
                                                {call.duration && call.duration > 0 && (
                                                    <span className="opacity-60 text-[10px] font-mono ml-1">• {formatDuration(call.duration)}</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => startCall(peer.id, call.type)}
                                        className="p-2.5 rounded-full bg-surface-highlight text-primary hover:bg-primary/10 transition-colors"
                                    >
                                        {call.type === 'video' ? (
                                            <Icons.Video className="w-5 h-5" />
                                        ) : (
                                            <Icons.Phone className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    }}
                />
            )}
        </div>
    );
};

export default CallList;