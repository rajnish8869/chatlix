
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, Icons, BottomSheet, ScrollDownFab } from '../components/AndroidUI';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message, Chat } from '../types';

const animationStyles = `
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .msg-anim {
    animation: slide-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
  }
`;

// Separate component to handle async decryption
const MessageContent = ({ msg, decryptFn }: { msg: Message, decryptFn: any }) => {
    const [text, setText] = useState(msg.type === 'encrypted' ? '🔓 Decrypting...' : msg.message);
    
    useEffect(() => {
        if (msg.type === 'encrypted') {
            decryptFn(msg.chat_id, msg.message, msg.sender_id).then(setText);
        } else {
            setText(msg.message);
        }
    }, [msg, decryptFn]);

    return <p className="text-[15.5px] leading-relaxed break-words whitespace-pre-wrap">{text}</p>;
};

const MessageItem = React.memo(({ 
    msg, isMe, showDate, onLongPress, onClick, isSelected, decryptFn 
}: { 
    msg: Message, isMe: boolean, showDate: boolean, onLongPress: (msg: Message) => void, onClick: (msg: Message) => void, isSelected: boolean, decryptFn: any 
}) => {
  const touchTimer = useRef<any>(undefined);

  const handleTouchStart = () => { touchTimer.current = setTimeout(() => onLongPress(msg), 500); };
  const handleTouchEnd = () => { if (touchTimer.current) clearTimeout(touchTimer.current); };

  return (
    <div className={`msg-anim pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] transition-colors ${isSelected ? 'bg-primary/10 py-1' : ''}`}>
      {showDate && (
        <div className="flex justify-center py-6">
          <span className="text-[10px] uppercase font-bold text-text-sub bg-surface/60 backdrop-blur-sm px-3 py-1 rounded-full tracking-widest shadow-sm">
            {new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
      <div 
        className={`flex flex-col mb-2 ${isMe ? 'items-end' : 'items-start'}`}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onMouseDown={handleTouchStart} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd}
        onClick={() => onClick(msg)}
      >
        <div className={`
            relative max-w-[82%] px-4 py-3 shadow-sm min-h-[44px] cursor-pointer active:scale-95 transition-transform duration-100
            ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
            ${isMe ? 'bg-msg-me text-primary-fg rounded-[22px] rounded-tr-md' : 'bg-msg-other text-text-main rounded-[22px] rounded-tl-md'} 
            ${msg.status === 'failed' ? 'border-2 border-red-500' : ''}
            ${msg.status === 'pending' ? 'opacity-80' : 'opacity-100'}
          `}
        >
          <MessageContent msg={msg} decryptFn={decryptFn} />
          
          <div className={`text-[10px] mt-1.5 text-right flex items-center justify-end gap-1 ${isMe ? 'text-primary-fg/70' : 'text-text-sub'}`}>
            <span className="font-medium tracking-wide">
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
            {isMe && (
              <span className="flex items-center ml-0.5 opacity-90 scale-90">
                {msg.status === 'pending' && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {msg.status === 'sent' && <span className="text-white/70"><Icons.Check /></span>}
                {msg.status === 'delivered' && <span className="text-white/70"><Icons.DoubleCheck /></span>}
                {msg.status === 'read' && <span className="text-blue-200"><Icons.DoubleCheck /></span>}
              </span>
            )}
            {msg.type === 'encrypted' && <span className="text-[8px] opacity-60 ml-1">🔒</span>}
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
  const { messages, loadMessages, sendMessage, chats, isOffline, markMessagesRead, contacts, loadContacts, decryptContent, deleteMessages } = useData();
  
  const [inputText, setInputText] = useState('');
  const [viewportHeight, setViewportHeight] = useState(window.visualViewport?.height || window.innerHeight);
  const [showScrollFab, setShowScrollFab] = useState(false);
  
  // Selection State
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedMsgIds.size > 0;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const chatMessages = chatId ? messages[chatId] || [] : [];
  const currentChat = chats.find(c => c.chat_id === chatId);
  
  // Resolve other user for online status
  const otherUserId = currentChat?.participants.find(p => p !== user?.user_id);
  const otherUser = contacts.find(c => c.user_id === otherUserId);
  const isOtherOnline = otherUser?.status === 'online';

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.visualViewport?.height || window.innerHeight);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      loadContacts();
    }
  }, [chatId, loadMessages, loadContacts]);

  useEffect(() => {
    if (!chatId || !user) return;
    const unreadMessages = chatMessages.filter(m => String(m.sender_id) !== String(user.user_id) && m.status !== 'read');
    if (unreadMessages.length > 0) {
        markMessagesRead(chatId, unreadMessages.map(m => m.message_id));
    }
  }, [chatMessages, chatId, user, markMessagesRead]);

  useEffect(() => {
      if(textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
  }, [inputText]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    const text = inputText;
    setInputText('');
    if(textareaRef.current) textareaRef.current.focus();
    virtuosoRef.current?.scrollTo({ top: 10000000, behavior: 'smooth' });
    await sendMessage(chatId, text);
  };

  const getChatName = () => {
      if (currentChat?.type === 'group' && currentChat.name) return currentChat.name;
      return otherUser ? otherUser.username : "Chat";
  };

  // Selection Logic
  const handleMessageClick = (msg: Message) => {
      if (isSelectionMode) {
          toggleSelection(msg.message_id);
      }
  };

  const handleLongPress = (msg: Message) => {
      if (!isSelectionMode) {
          if(navigator.vibrate) navigator.vibrate(50);
      }
      toggleSelection(msg.message_id);
  };

  const toggleSelection = (msgId: string) => {
      setSelectedMsgIds(prev => {
          const next = new Set(prev);
          if (next.has(msgId)) next.delete(msgId);
          else next.add(msgId);
          return next;
      });
  };

  const handleDelete = async () => {
      if (!chatId) return;
      if (confirm(`Delete ${selectedMsgIds.size} message(s)?`)) {
          await deleteMessages(chatId, Array.from(selectedMsgIds));
          setSelectedMsgIds(new Set());
      }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden" style={{ height: `${viewportHeight}px` }}>
      <style>{animationStyles}</style>
      
      {isSelectionMode ? (
        <TopBar 
            className="z-30 flex-shrink-0 bg-surface text-text-main"
            title={`${selectedMsgIds.size} Selected`}
            onBack={() => setSelectedMsgIds(new Set())}
            actions={
                <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                    <Icons.Trash />
                </button>
            }
        />
      ) : (
        <TopBar 
            className="z-30 flex-shrink-0"
            title={
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-highlight flex items-center justify-center text-primary text-base font-bold shadow-sm border border-border">
                    {getChatName()[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <span className="text-base font-bold truncate">{getChatName()}</span>
                    {currentChat?.type === 'private' && (
                        <span className={`text-[11px] font-medium flex items-center gap-1 ${isOtherOnline ? 'text-green-500' : 'text-text-sub'}`}>
                            {isOtherOnline ? 'Online' : 'Offline'}
                        </span>
                    )}
                </div>
            </div>
            } 
            onBack={() => navigate('/')} 
            onClickTitle={() => navigate(`/chat/${chatId}/info`)}
        />
      )}

      <div className="flex-1 min-h-0 relative">
        <Virtuoso
          ref={virtuosoRef}
          data={chatMessages}
          initialTopMostItemIndex={Math.max(0, chatMessages.length - 1)}
          alignToBottom
          overscan={500}
          atBottomStateChange={(atBottom) => setShowScrollFab(!atBottom)}
          followOutput={(isAtBottom) => {
             const lastMsg = chatMessages[chatMessages.length - 1];
             if (lastMsg && String(lastMsg.sender_id) === String(user?.user_id)) return 'smooth';
             return isAtBottom ? 'smooth' : false;
          }}
          itemContent={(index, msg) => {
            const isMe = String(msg.sender_id) === String(user?.user_id);
            const showDate = index === 0 || msg.timestamp.substring(0,10) !== chatMessages[index-1]?.timestamp.substring(0,10);
            return (
                <MessageItem 
                    msg={msg} 
                    isMe={isMe} 
                    showDate={showDate} 
                    onLongPress={handleLongPress} 
                    onClick={handleMessageClick}
                    isSelected={selectedMsgIds.has(msg.message_id)}
                    decryptFn={decryptContent} 
                />
            );
          }}
        />
        <ScrollDownFab onClick={() => virtuosoRef.current?.scrollTo({ top: 10000000, behavior: 'smooth' })} visible={showScrollFab} />
      </div>

      <div className="w-full bg-surface/90 backdrop-blur-lg border-t border-border p-3 flex-shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        {currentChat?.type === 'private' && <div className="text-[10px] text-center text-text-sub opacity-70 mb-2 flex items-center justify-center gap-1"><span className="text-primary"><Icons.Check /></span> Messages are end-to-end encrypted</div>}
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 rounded-[24px] bg-surface-highlight border border-border flex items-center px-4 py-1.5">
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Message"
                    rows={1}
                    className="w-full bg-transparent text-text-main text-[16px] border-none focus:ring-0 resize-none min-h-[24px] max-h-[120px] py-2"
                />
            </div>
            <button onClick={handleSend} disabled={!inputText.trim()} className="w-12 h-12 rounded-full bg-primary text-primary-fg flex items-center justify-center shadow-glow">
              <Icons.Send />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatDetail;
