import React, { useEffect, useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, FAB } from '../components/AndroidUI';
import { useNavigate } from 'react-router-dom';
import { Chat, Message } from '../types';

const ChatList: React.FC = () => {
  const { chats, refreshChats, syncing, messages } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Pull to refresh state
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80;

  useEffect(() => {
    refreshChats();
    // eslint-disable-next-line
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === 0) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
        // Resistance effect
        setPullY(Math.min(diff * 0.5, PULL_THRESHOLD + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullY > PULL_THRESHOLD) {
        setPullY(PULL_THRESHOLD); // Snap to threshold
        await refreshChats();
    }
    setPullY(0);
    startY.current = 0;
  };

  // Helper to get the actual last message, prioritizing local real-time data
  const getLastMessage = (chat: Chat): Message | undefined => {
    const localMsgs = messages[chat.chat_id];
    if (localMsgs && localMsgs.length > 0) {
      return localMsgs[localMsgs.length - 1];
    }
    return chat.last_message;
  };

  const isChatUnread = (chat: Chat, lastMsg?: Message) => {
    if (!user || !lastMsg) return false;
    return lastMsg.sender_id !== user.user_id && lastMsg.status !== 'read';
  };

  return (
    <div className="min-h-screen bg-background pb-20 overflow-hidden flex flex-col">
      <TopBar 
        title="Messages" 
        actions={syncing && <span className="text-xs text-primary animate-pulse mr-2">Syncing...</span>}
      />

      {/* Pull Indicator */}
      <div 
        className="w-full flex justify-center overflow-hidden transition-all duration-300 ease-out"
        style={{ height: `${pullY}px`, opacity: pullY > 0 ? 1 : 0 }}
      >
        <div className="flex items-center text-primary text-sm font-bold">
            {pullY > PULL_THRESHOLD ? 'Release to refresh' : 'Pull down'}
        </div>
      </div>

      <div 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar"
      >
        {chats.length === 0 && !syncing && (
          <div className="text-center text-gray-500 mt-20">
            No chats found. <br /> Tap + to start.
          </div>
        )}

        {chats.map(chat => {
          const lastMsg = getLastMessage(chat);
          const unread = isChatUnread(chat, lastMsg);
          
          return (
            <div 
              key={chat.chat_id}
              onClick={() => navigate(`/chat/${chat.chat_id}`)}
              className={`
                p-4 rounded-xl active:bg-surface transition-all flex items-center gap-4 border border-transparent
                ${unread ? 'bg-surface/80 border-primary/20 shadow-sm shadow-primary/5' : 'bg-surface/50'}
              `}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {chat.name ? chat.name[0] : '#'}
                </div>
                {unread && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-background shadow-sm" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className={`truncate ${unread ? 'font-bold text-white' : 'font-medium text-gray-200'}`}>
                    {chat.name || `Chat ${chat.chat_id}`}
                  </h3>
                  <span className={`text-xs ${unread ? 'text-primary font-bold' : 'text-gray-500'}`}>
                      {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                  </span>
                </div>
                <p className={`text-sm truncate ${unread ? 'text-gray-100 font-medium' : 'text-gray-400'}`}>
                  {lastMsg?.sender_id === user?.user_id && <span className="text-gray-500 mr-1">You:</span>}
                  {lastMsg?.message || "No messages yet"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <FAB onClick={() => navigate('/new-chat')} />
    </div>
  );
};

export default ChatList;