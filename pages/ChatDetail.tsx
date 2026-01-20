import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, Icons, BottomSheet, ScrollDownFab } from '../components/AndroidUI';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message } from '../types';

// --- Styles for Animation ---
const animationStyles = `
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .msg-anim {
    animation: slide-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
  }
`;

// --- Message Bubble Component ---
const MessageItem = React.memo(({ 
    msg, 
    isMe, 
    showDate, 
    onLongPress 
}: { 
    msg: Message, 
    isMe: boolean, 
    showDate: boolean, 
    onLongPress: (msg: Message) => void 
}) => {
    
  // Long press logic
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleTouchStart = () => {
      touchTimer.current = setTimeout(() => {
          onLongPress(msg);
      }, 500);
  };

  const handleTouchEnd = () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  return (
    <div className="px-4 msg-anim">
      {showDate && (
        <div className="flex justify-center py-6">
          <span className="text-[10px] uppercase font-bold text-text-sub bg-surface/60 backdrop-blur-sm px-3 py-1 rounded-full tracking-widest shadow-sm">
            {new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
      <div 
        className={`flex flex-col mb-2 ${isMe ? 'items-end' : 'items-start'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        <div 
          className={`
            relative max-w-[82%] px-4 py-3 shadow-sm min-h-[44px] cursor-pointer active:scale-95 transition-transform duration-100
            ${isMe 
              ? 'bg-msg-me text-primary-fg rounded-[22px] rounded-tr-md' 
              : 'bg-msg-other text-text-main rounded-[22px] rounded-tl-md'
            } 
            ${msg.status === 'failed' ? 'border-2 border-red-500' : ''}
          `}
        >
          <p className="text-[15.5px] leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
          
          <div className={`text-[10px] mt-1.5 text-right flex items-center justify-end gap-1 ${isMe ? 'text-primary-fg/70' : 'text-text-sub'}`}>
            <span className="font-medium tracking-wide">
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
            {isMe && (
              <span className="flex items-center ml-0.5 opacity-90 scale-90">
                {msg.status === 'pending' && <span className="animate-spin w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full"></span>}
                {msg.status === 'sent' && <Icons.Check />}
                {msg.status === 'delivered' && <Icons.DoubleCheck />}
                {msg.status === 'read' && <span className="text-white"><Icons.DoubleCheck /></span>}
                {msg.status === 'failed' && <span className="text-red-200 font-bold">!</span>}
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
  const [viewportHeight, setViewportHeight] = useState(window.visualViewport?.height || window.innerHeight);
  const [showScrollFab, setShowScrollFab] = useState(false);
  
  // Context Menu State
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  const chatMessages = chatId ? messages[chatId] || [] : [];
  const currentChat = chats.find(c => c.chat_id === chatId);
  
  const prevMsgCount = useRef(chatMessages.length);
  const prevViewportHeight = useRef(viewportHeight);

  // --- 1. Viewport & Keyboard Handling ---
  useEffect(() => {
    const handleResize = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(h);
      
      if (prevViewportHeight.current - h > 150) {
          // Keyboard detected (Shrink)
          setTimeout(() => {
              virtuosoRef.current?.scrollToIndex({ index: chatMessages.length - 1, align: 'end', behavior: 'auto' });
          }, 100);
      }
      prevViewportHeight.current = h;
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    
    return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.removeEventListener('resize', handleResize);
    };
  }, [chatMessages.length]);

  // --- 2. Auto-Scroll on New Message ---
  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg && String(lastMsg.sender_id) === String(user?.user_id)) {
             setTimeout(() => {
                 virtuosoRef.current?.scrollToIndex({ index: chatMessages.length - 1, align: 'end', behavior: 'smooth' });
             }, 50);
        }
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages, user?.user_id]);

  // --- 3. Data Loading ---
  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      const interval = setInterval(() => {
          if (!isOffline) {
              const currentMsgs = messages[chatId] || [];
              let lastTimestamp = undefined;
              if (currentMsgs.length > 0) {
                  const confirmedMsgs = currentMsgs.filter(m => !m.message_id.startsWith('temp-'));
                  if (confirmedMsgs.length > 0) lastTimestamp = confirmedMsgs[confirmedMsgs.length - 1].timestamp;
              }
              loadMessages(chatId, undefined, lastTimestamp);
          }
      }, Math.max(2000, settings.polling_interval / 2)); 
      return () => clearInterval(interval);
    }
  }, [chatId, isOffline, settings.polling_interval]);

  // --- Mark Read ---
  useEffect(() => {
    if (!chatId || !user) return;
    const unreadMessages = chatMessages.filter(
        m => String(m.sender_id) !== String(user.user_id) && m.status !== 'read'
    );
    if (unreadMessages.length > 0) {
        markMessagesRead(chatId, unreadMessages.map(m => m.message_id));
    }
  }, [chatMessages, chatId, user]);

  // --- Auto-Grow Input ---
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  // --- Handlers ---
  const handleStartReached = useCallback(async () => {
    if (loadingTop || chatMessages.length < 20 || !chatId) return;
    setLoadingTop(true);
    const oldestMsg = chatMessages[0];
    await loadMessages(chatId, oldestMsg.timestamp); 
    setLoadingTop(false);
  }, [chatId, chatMessages, loadingTop, loadMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    const text = inputText;
    setInputText('');
    
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
    }
    
    virtuosoRef.current?.scrollToIndex({ index: chatMessages.length, align: 'end', behavior: 'smooth' });
    await sendMessage(chatId, text);
  };

  const handleScrollToBottom = () => {
      // Use scrollToIndex with align: 'end' to ensure the last item is fully visible
      // This forces Virtuoso to measure items if they haven't been rendered yet.
      virtuosoRef.current?.scrollToIndex({ 
          index: chatMessages.length - 1, 
          align: 'end', 
          behavior: 'smooth' 
      });
  };

  const handleCopyMessage = () => {
      if (selectedMessage) {
          navigator.clipboard.writeText(selectedMessage.message);
          setSelectedMessage(null);
      }
  };

  const handleReplyMessage = () => {
      if (selectedMessage) {
          // Quote reply logic
          const shortMsg = selectedMessage.message.length > 30 
            ? selectedMessage.message.substring(0, 30) + '...' 
            : selectedMessage.message;
            
          setInputText(prev => `> ${shortMsg}\n\n${prev}`);
          setSelectedMessage(null);
          textareaRef.current?.focus();
      }
  };

  const shouldShowDate = (index: number, msgs: Message[]) => {
      if (index === 0) return true;
      const current = msgs[index];
      const prev = msgs[index - 1];
      if (!current || !prev) return false;
      return current.timestamp.substring(0, 10) !== prev.timestamp.substring(0, 10);
  };

  return (
    <div 
        className="fixed inset-0 flex flex-col bg-background overflow-hidden" 
        style={{ height: `${viewportHeight}px` }}
    >
      <style>{animationStyles}</style>
      
      {/* Top Bar with Clickable Title for Chat Info */}
      <TopBar 
        className="z-30 flex-shrink-0"
        title={
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-surface-highlight flex items-center justify-center text-primary text-base font-bold shadow-sm border border-border">
                {currentChat?.name ? currentChat.name[0].toUpperCase() : '#'}
             </div>
             <div className="flex flex-col overflow-hidden">
                <span className="text-base font-bold leading-tight truncate">{currentChat?.name || 'Chat'}</span>
                <span className="text-[11px] text-text-sub flex items-center gap-1">
                   {isOffline ? <span className="text-red-400 font-bold">Offline</span> : 'Tap for info'}
                </span>
             </div>
          </div>
        } 
        onBack={() => navigate('/')} 
        onClickTitle={() => navigate(`/chat/${chatId}/info`)}
      />

      {/* Messages Container */}
      <div className="flex-1 min-h-0 relative">
        <Virtuoso
          ref={virtuosoRef}
          key={chatId}
          style={{ height: '100%' }}
          data={chatMessages}
          startReached={handleStartReached}
          initialTopMostItemIndex={Math.max(0, chatMessages.length - 1)}
          alignToBottom
          overscan={500}
          atBottomStateChange={(atBottom) => {
              setShowScrollFab(!atBottom);
          }}
          followOutput={(isAtBottom) => {
             const lastMsg = chatMessages[chatMessages.length - 1];
             if (!lastMsg) return false;
             if (String(lastMsg.sender_id) === String(user?.user_id)) return 'smooth';
             return isAtBottom ? 'smooth' : false;
          }}
          components={{
            Header: () => loadingTop ? <div className="text-center text-xs text-text-sub py-6">Loading history...</div> : <div className="h-6" />,
            Footer: () => <div className="h-2" />
          }}
          itemContent={(index, msg) => {
            const isMe = String(msg.sender_id) === String(user?.user_id);
            const showDate = shouldShowDate(index, chatMessages);
            return <MessageItem msg={msg} isMe={isMe} showDate={showDate} onLongPress={setSelectedMessage} />;
          }}
        />
        
        <ScrollDownFab onClick={handleScrollToBottom} visible={showScrollFab} />
      </div>

      {/* Input Area */}
      <div 
        className="w-full bg-surface/90 backdrop-blur-lg border-t border-border p-3 transition-all z-40 flex-shrink-0"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 bg-surface-highlight rounded-[24px] border border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex items-center px-4 py-1.5 shadow-sm">
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={isOffline ? "Waiting for connection..." : "Message"}
                    rows={1}
                    className="w-full bg-transparent text-text-main text-[16px] border-none focus:ring-0 resize-none min-h-[24px] max-h-[120px] py-2 leading-relaxed placeholder:text-text-sub/60"
                    style={{ padding: '4px 0' }}
                />
            </div>
            
            <button 
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="w-12 h-12 rounded-full bg-primary text-primary-fg flex items-center justify-center disabled:opacity-50 disabled:scale-95 transition-all shadow-glow active:scale-90"
            >
              <Icons.Send />
            </button>
        </div>
      </div>

      {/* Context Menu Sheet */}
      <BottomSheet isOpen={!!selectedMessage} onClose={() => setSelectedMessage(null)}>
         <div className="space-y-1">
             <button 
                onClick={handleReplyMessage}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-highlight active:bg-surface-highlight transition-colors text-text-main"
             >
                 <span className="p-2 bg-secondary rounded-full"><Icons.Reply /></span>
                 <span className="font-semibold text-lg">Reply</span>
             </button>
             <button 
                onClick={handleCopyMessage}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-highlight active:bg-surface-highlight transition-colors text-text-main"
             >
                 <span className="p-2 bg-secondary rounded-full"><Icons.Copy /></span>
                 <span className="font-semibold text-lg">Copy Text</span>
             </button>
         </div>
         {selectedMessage && (
             <div className="mt-6 p-4 bg-surface-highlight/50 rounded-xl border border-border">
                <p className="text-xs font-bold text-text-sub uppercase mb-1">Message Details</p>
                <p className="text-sm text-text-main font-mono text-opacity-70">ID: {selectedMessage.message_id}</p>
                <p className="text-sm text-text-main font-mono text-opacity-70">Sent: {new Date(selectedMessage.timestamp).toLocaleString()}</p>
             </div>
         )}
      </BottomSheet>
    </div>
  );
};

export default ChatDetail;