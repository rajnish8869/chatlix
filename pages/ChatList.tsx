import React, { useEffect, useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { TopBar, FAB } from '../components/AndroidUI';
import { useNavigate } from 'react-router-dom';

const ChatList: React.FC = () => {
  const { chats, refreshChats, syncing } = useData();
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

        {chats.map(chat => (
          <div 
            key={chat.chat_id}
            onClick={() => navigate(`/chat/${chat.chat_id}`)}
            className="bg-surface/50 p-4 rounded-xl active:bg-surface transition-colors flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {chat.name ? chat.name[0] : '#'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-medium text-white truncate">
                  {chat.name || `Chat ${chat.chat_id}`}
                </h3>
                <span className="text-xs text-gray-500">
                    {chat.last_message ? new Date(chat.last_message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                </span>
              </div>
              <p className="text-sm text-gray-400 truncate">
                {chat.last_message?.message || "No messages yet"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <FAB onClick={() => navigate('/new-chat')} />
    </div>
  );
};

export default ChatList;