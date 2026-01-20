import React, { useEffect, useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, FAB, Icons } from '../components/AndroidUI';
import { useNavigate } from 'react-router-dom';
import { Chat, Message } from '../types';

const ChatList: React.FC = () => {
  const { chats, refreshChats, syncing, messages } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pull to refresh
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 90;

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
        setPullY(Math.min(diff * 0.45, PULL_THRESHOLD + 30));
    }
  };

  const handleTouchEnd = async () => {
    if (pullY > PULL_THRESHOLD) {
        setPullY(PULL_THRESHOLD);
        await refreshChats();
    }
    setPullY(0);
    startY.current = 0;
  };

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

  const filteredChats = chats.filter(chat => {
    const name = chat.name || `Chat ${chat.chat_id}`;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div 
      className="flex-1 flex flex-col bg-background h-screen overflow-hidden"
    >
      <TopBar 
        title={
          isSearchOpen ? (
            <input 
                autoFocus
                type="text"
                placeholder="Search conversations..."
                className="w-full bg-transparent border-none focus:outline-none text-text-main text-lg placeholder-text-sub font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
          ) : "Messages"
        }
        onBack={isSearchOpen ? () => { setIsSearchOpen(false); setSearchQuery(''); } : undefined}
        actions={
            !isSearchOpen ? (
                <>
                    {syncing && <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-3"></div>}
                    <button onClick={() => setIsSearchOpen(true)} className="p-2.5 rounded-full text-text-main hover:bg-surface/50 tap-active">
                        <Icons.Search />
                    </button>
                </>
            ) : (
                <button onClick={() => setSearchQuery('')} className="p-2.5 rounded-full text-text-sub tap-active">
                    <Icons.Close />
                </button>
            )
        }
      />

      {/* Pull Indicator */}
      <div 
        className="w-full flex justify-center items-center overflow-hidden transition-all duration-300 ease-out absolute top-16 left-0 z-10 pointer-events-none"
        style={{ height: `${pullY}px`, opacity: pullY > 0 ? (pullY / PULL_THRESHOLD) : 0 }}
      >
        <div className="bg-surface shadow-lg rounded-full p-2">
            <div className={`w-5 h-5 border-2 border-primary border-t-transparent rounded-full ${pullY >= PULL_THRESHOLD ? 'animate-spin' : ''}`} />
        </div>
      </div>

      <div 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto px-4 pb-32 pt-2 no-scrollbar scroll-smooth"
      >
        {filteredChats.length === 0 && !syncing && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-text-sub opacity-50">
             <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4">
                <Icons.Chat />
             </div>
             <span className="text-base font-medium">No conversations</span>
          </div>
        )}

        {filteredChats.map(chat => {
          const lastMsg = getLastMessage(chat);
          const unread = isChatUnread(chat, lastMsg);
          const chatName = chat.name || `Chat ${chat.chat_id}`;
          const initials = chatName.substring(0, 2).toUpperCase();
          
          return (
            <div 
              key={chat.chat_id}
              onClick={() => navigate(`/chat/${chat.chat_id}`)}
              className={`
                relative mb-3 p-4 rounded-[20px] tap-active transition-all cursor-pointer flex items-center gap-4 border
                ${unread ? 'bg-surface border-border shadow-soft' : 'bg-transparent border-transparent hover:bg-surface/50'}
              `}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm
                    ${unread ? 'bg-gradient-to-tr from-primary to-purple-500' : 'bg-surface-highlight text-text-sub'}
                `}>
                  {initials}
                </div>
                {unread && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-[3px] border-surface shadow-sm" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className={`truncate text-[17px] ${unread ? 'font-bold text-text-main' : 'font-semibold text-text-main/80'}`}>
                    {chatName}
                  </h3>
                  <span className={`text-[11px] font-medium ${unread ? 'text-primary' : 'text-text-sub/70'}`}>
                      {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                    {lastMsg?.sender_id === user?.user_id && (
                        <span className={`flex-shrink-0 ${lastMsg?.status === 'read' ? 'text-primary' : 'text-text-sub'}`}>
                            {lastMsg?.status === 'read' ? <Icons.DoubleCheck /> : <Icons.Check />}
                        </span>
                    )}
                    <p className={`text-[14px] truncate leading-snug ${unread ? 'text-text-main font-medium' : 'text-text-sub'}`}>
                    {lastMsg?.message || <span className="italic opacity-50">Start a conversation</span>}
                    </p>
                </div>
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