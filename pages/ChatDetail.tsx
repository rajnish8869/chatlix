import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, Icons } from '../components/AndroidUI';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message } from '../types';

// --- Message Item Component (Memoized) ---
const MessageItem = React.memo(({ msg, isMe, showDate }: { msg: Message, isMe: boolean, showDate: boolean }) => {
  return (
    <div className="py-1 px-4">
      {showDate && (
        <div className="text-center text-[10px] text-gray-600 my-4 uppercase tracking-widest font-bold">
          {new Date(msg.timestamp).toLocaleDateString()}
        </div>
      )}
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div 
          className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
            isMe 
              ? 'bg-primary text-white rounded-br-sm' 
              : 'bg-surface text-gray-200 rounded-bl-sm'
          } ${msg.status === 'failed' ? 'border border-red-500' : ''}`}
        >
          <p>{msg.message}</p>
          <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            {isMe && (
              <span>
                {msg.status === 'pending' && <span className="animate-pulse">🕒</span>}
                {msg.status === 'sent' && '✓'}
                {msg.status === 'delivered' && '✓✓'}
                {msg.status === 'read' && <span className="text-blue-200">✓✓</span>}
                {msg.status === 'failed' && <span className="text-red-400 font-bold bg-white/20 rounded-full w-4 h-4 inline-flex items-center justify-center ml-1">!</span>}
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
  const { messages, loadMessages, sendMessage, chats, isOffline } = useData();
  
  const [inputText, setInputText] = useState('');
  const [loadingTop, setLoadingTop] = useState(false);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  const chatMessages = chatId ? messages[chatId] || [] : [];
  const currentChat = chats.find(c => c.chat_id === chatId);

  // Initial Load
  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
    }
  }, [chatId]);

  // Load older messages when scrolling to top
  const handleStartReached = useCallback(async () => {
    if (loadingTop || chatMessages.length < 20 || !chatId) return;
    
    setLoadingTop(true);
    const oldestMsg = chatMessages[0];
    // Keep reference to the first item before loading
    const firstItemIndex = 0; 
    
    await loadMessages(chatId, oldestMsg.timestamp);
    setLoadingTop(false);
    
    // Virtuoso handles scroll preservation automatically via `firstItemIndex` logic usually,
    // but with "startReached", we might need to adjust.
    // However, Virtuoso's `startReached` is designed for bi-directional or reverse scrolling.
    // Since we are strictly prepending, Virtuoso handles the offset if configured correctly.
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

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar 
        title={currentChat?.name || 'Chat'} 
        onBack={() => navigate('/')} 
        actions={isOffline ? <span className="text-xs text-red-400 mr-2">Offline</span> : null}
      />

      {/* Messages Area using Virtuoso for Virtualization */}
      <div className="flex-1 overflow-hidden bg-background">
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={chatMessages}
          startReached={handleStartReached}
          initialTopMostItemIndex={chatMessages.length - 1} // Start at bottom
          followOutput={'auto'} // Stick to bottom on new messages
          alignToBottom // Align content to bottom if list is short
          components={{
            Header: () => loadingTop ? <div className="text-center text-xs text-gray-500 py-2">Loading history...</div> : null
          }}
          itemContent={(index, msg) => {
            const isMe = msg.sender_id === user?.user_id;
            const showDate = index === 0 || new Date(msg.timestamp).toDateString() !== new Date(chatMessages[index - 1]?.timestamp).toDateString();
            
            return <MessageItem msg={msg} isMe={isMe} showDate={showDate} />;
          }}
        />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-surface border-t border-white/5 flex items-center gap-2">
        <input 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isOffline ? "Queued for sending..." : "Message..."}
          className="flex-1 bg-background text-white rounded-full px-4 py-3 focus:outline-none border border-transparent focus:border-primary/50 placeholder-gray-600"
        />
        <button 
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="p-3 bg-primary rounded-full text-white disabled:opacity-50 active:scale-95 transition-transform"
        >
          <Icons.Send />
        </button>
      </div>
    </div>
  );
};

export default ChatDetail;