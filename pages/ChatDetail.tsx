import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, Icons } from '../components/AndroidUI';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message } from '../types';

// --- Styles for Animation ---
const animationStyles = `
  @keyframes msg-enter {
    0% { opacity: 0; transform: translateY(10px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  .msg-anim {
    animation: msg-enter 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }
`;

// --- Message Item Component (Memoized) ---
const MessageItem = React.memo(({ msg, isMe, showDate }: { msg: Message, isMe: boolean, showDate: boolean }) => {
  return (
    <div className="px-3 msg-anim">
      {showDate && (
        <div className="flex justify-center py-4">
          <span className="text-[11px] text-gray-400 bg-surface/80 px-3 py-1 rounded-full border border-white/5 font-medium tracking-wide shadow-sm backdrop-blur-sm">
            {new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
      <div className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div 
          className={`
            relative max-w-[85%] px-4 py-2 shadow-sm
            ${isMe 
              ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl rounded-br-none' 
              : 'bg-slate-700 text-gray-100 rounded-2xl rounded-bl-none'
            } 
            ${msg.status === 'failed' ? 'border border-red-500' : 'border border-transparent'}
          `}
        >
          <p className="text-[15px] leading-relaxed break-words">{msg.message}</p>
          
          <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
            <span className="opacity-90">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            {isMe && (
              <span className="flex items-center ml-0.5">
                {msg.status === 'pending' && <span className="animate-pulse">🕒</span>}
                {msg.status === 'sent' && <span>✓</span>}
                {msg.status === 'delivered' && <span>✓✓</span>}
                {msg.status === 'read' && <span className="text-cyan-300">✓✓</span>}
                {msg.status === 'failed' && <span className="text-red-300 font-bold">!</span>}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

const ChatDetail: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, loadMessages, sendMessage, chats, isOffline, markMessagesRead, settings } = useData();
  
  const [inputText, setInputText] = useState('');
  const [loadingTop, setLoadingTop] = useState(false);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  const chatMessages = chatId ? messages[chatId] || [] : [];
  const currentChat = chats.find(c => c.chat_id === chatId);

  // Initial Load & Polling for Status Updates (Delta Sync)
  useEffect(() => {
    if (chatId) {
      // 1. Initial full load (or default latest 20)
      loadMessages(chatId);
      
      const interval = setInterval(() => {
          if (!isOffline) {
              // 2. Delta Poll: Ask for messages AFTER the last known timestamp
              const currentMsgs = messages[chatId] || [];
              let lastTimestamp = undefined;
              if (currentMsgs.length > 0) {
                  // Find the last real message (not pending/temp)
                  const confirmedMsgs = currentMsgs.filter(m => !m.message_id.startsWith('temp-'));
                  if (confirmedMsgs.length > 0) {
                      lastTimestamp = confirmedMsgs[confirmedMsgs.length - 1].timestamp;
                  }
              }
              loadMessages(chatId, undefined, lastTimestamp);
          }
      }, Math.max(2000, settings.polling_interval / 2)); 

      return () => clearInterval(interval);
    }
  }, [chatId, isOffline, settings.polling_interval]); // Intentionally omitting `messages` to avoid resetting interval on every message

  // Mark visible messages as Read
  useEffect(() => {
    if (!chatId || !user) return;
    
    // Find messages sent by others that are NOT read
    const unreadMessages = chatMessages.filter(
        m => m.sender_id !== user.user_id && m.status !== 'read'
    );

    if (unreadMessages.length > 0) {
        const ids = unreadMessages.map(m => m.message_id);
        markMessagesRead(chatId, ids);
    }
  }, [chatMessages, chatId, user]);


  // Load older messages when scrolling to top
  const handleStartReached = useCallback(async () => {
    if (loadingTop || chatMessages.length < 20 || !chatId) return;
    
    setLoadingTop(true);
    const oldestMsg = chatMessages[0];
    
    await loadMessages(chatId, oldestMsg.timestamp); // Use beforeTimestamp
    setLoadingTop(false);
  }, [chatId, chatMessages, loadingTop, loadMessages]);


  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    const text = inputText;
    setInputText('');
    await sendMessage(chatId, text);
    // Scroll to bottom
    requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({ index: chatMessages.length, align: 'end', behavior: 'smooth' });
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  }

  // Efficient Date Comparison for Virtualization
  const shouldShowDate = (index: number, msgs: Message[]) => {
      if (index === 0) return true;
      const current = msgs[index];
      const prev = msgs[index - 1];
      
      if (!current || !prev) return false;
      
      const d1 = current.timestamp.substring(0, 10);
      const d2 = prev.timestamp.substring(0, 10);
      
      return d1 !== d2;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <style>{animationStyles}</style>
      <TopBar 
        title={currentChat?.name || 'Chat'} 
        onBack={() => navigate('/')} 
        actions={isOffline ? <span className="text-xs text-red-400 mr-2 font-bold bg-red-900/20 px-2 py-1 rounded">OFFLINE</span> : null}
      />

      {/* Messages Area using Virtuoso for Virtualization */}
      <div className="flex-1 overflow-hidden bg-[#0b1221]">
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={chatMessages}
          startReached={handleStartReached}
          initialTopMostItemIndex={chatMessages.length - 1} // Start at bottom
          followOutput={'auto'} // Stick to bottom on new messages
          alignToBottom // Align content to bottom if list is short
          components={{
            Header: () => loadingTop ? <div className="text-center text-xs text-gray-500 py-4">Loading history...</div> : <div className="h-4" />
          }}
          itemContent={(index, msg) => {
            const isMe = msg.sender_id === user?.user_id;
            const showDate = shouldShowDate(index, chatMessages);
            return <MessageItem msg={msg} isMe={isMe} showDate={showDate} />;
          }}
        />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-surface border-t border-white/5 flex items-center gap-2 pb-safe-bottom">
        <input 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isOffline ? "Waiting for connection..." : "Message..."}
          className="flex-1 bg-background text-white rounded-full px-5 py-3 focus:outline-none border border-secondary/30 focus:border-primary/50 placeholder-gray-500 transition-all"
        />
        <button 
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="p-3 bg-primary rounded-full text-white disabled:opacity-50 disabled:bg-gray-700 active:scale-90 transition-all shadow-lg shadow-primary/20"
        >
          <Icons.Send />
        </button>
      </div>
    </div>
  );
};

export default ChatDetail;