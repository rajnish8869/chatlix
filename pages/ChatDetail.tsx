
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, Icons, ScrollDownFab, ConfirmationModal, Avatar, ImageViewer } from '../components/AndroidUI';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message } from '../types';

const MessageContent = ({ msg, decryptFn }: { msg: Message, decryptFn: any }) => {
    const [text, setText] = useState(msg.type === 'encrypted' ? '🔓 Decrypting...' : msg.message);
    
    useEffect(() => {
        if (msg.type === 'encrypted') {
            decryptFn(msg.chat_id, msg.message, msg.sender_id).then(setText);
        } else {
            setText(msg.message);
        }
    }, [msg, decryptFn]);

    return <p className="text-[15px] leading-[1.5] break-words whitespace-pre-wrap">{text}</p>;
};

const MessageItem = React.memo(({ 
    msg, isMe, showDate, onLongPress, onClick, isSelected, decryptFn, senderName, onImageClick 
}: { 
    msg: Message, isMe: boolean, showDate: boolean, onLongPress: (msg: Message) => void, onClick: (msg: Message) => void, isSelected: boolean, decryptFn: any, senderName?: string, onImageClick: (url: string) => void
}) => {
  const touchTimer = useRef<any>(undefined);

  const handleTouchStart = () => { touchTimer.current = setTimeout(() => onLongPress(msg), 400); };
  const handleTouchEnd = () => { if (touchTimer.current) clearTimeout(touchTimer.current); };

  const getNameColor = (name: string) => {
    const colors = ['text-blue-500', 'text-emerald-500', 'text-amber-500', 'text-purple-500', 'text-rose-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`px-4 animate-fade-in transition-colors ${isSelected ? 'bg-primary/10 -mx-4 px-8 py-2' : ''}`}>
      {showDate && (
        <div className="flex justify-center py-6">
          <span className="text-[10px] font-bold tracking-wide text-text-sub bg-surface/80 backdrop-blur border border-white/5 px-3 py-1 rounded-full shadow-sm">
            {new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          </span>
        </div>
      )}
      <div 
        className={`flex flex-col mb-2 ${isMe ? 'items-end' : 'items-start'}`}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onMouseDown={handleTouchStart} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd}
        onClick={() => onClick(msg)}
      >
        {senderName && (
             <span className={`text-[11px] font-bold mb-1 ml-3 block max-w-[80%] truncate ${getNameColor(senderName)}`}>
                {senderName}
             </span>
        )}

        <div className={`
            relative max-w-[80%] shadow-sm active:scale-[0.98] transition-all
            ${isMe 
                ? 'bg-msg-me text-white rounded-[24px] rounded-tr-sm shadow-primary/20' 
                : 'bg-msg-other text-text-main rounded-[24px] rounded-tl-sm border border-white/5'
            } 
            ${msg.status === 'failed' ? 'border-2 border-danger' : ''}
            ${msg.type === 'image' ? 'p-1' : 'px-5 py-3'} 
          `}
        >
          {msg.type === 'image' ? (
              <img 
                src={msg.message} 
                alt="Attachment" 
                className="rounded-[20px] max-w-full h-auto cursor-pointer" 
                style={{ maxHeight: '300px' }}
                onClick={(e) => {
                    e.stopPropagation();
                    onImageClick(msg.message);
                }}
              />
          ) : (
             <MessageContent msg={msg} decryptFn={decryptFn} />
          )}
          
          <div className={`text-[9px] mt-1.5 text-right flex items-center justify-end gap-1 ${isMe ? 'text-white/70' : 'text-text-sub'} ${msg.type === 'image' ? 'pr-2 pb-1' : ''}`}>
            <span className="font-medium">
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
            {isMe && (
              <span className="flex items-center gap-0.5 ml-1">
                {msg.status === 'pending' && <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white/50 border-t-white animate-spin" />}
                {msg.status === 'sent' && <Icons.Check className="w-3.5 h-3.5 text-white/60" />}
                {msg.status === 'delivered' && <Icons.DoubleCheck className="w-3.5 h-3.5 text-white/60" />}
                {msg.status === 'read' && <Icons.DoubleCheck className="w-3.5 h-3.5 text-cyan-300" />}
              </span>
            )}
            {msg.type === 'encrypted' && <span className="text-[8px] opacity-70"><Icons.Lock /></span>}
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
  const { messages, loadMessages, sendMessage, sendImage, chats, markChatAsRead, contacts, loadContacts, decryptContent, deleteMessages } = useData();
  
  const [inputText, setInputText] = useState('');
  const [viewportHeight, setViewportHeight] = useState(window.visualViewport?.height || window.innerHeight);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Image Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState('');
  
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedMsgIds.size > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const chatMessages = chatId ? messages[chatId] || [] : [];
  const currentChat = chats.find(c => c.chat_id === chatId);
  
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

  // Mark chat as read when opening or when new messages arrive while open
  useEffect(() => {
    if (!chatId || !user) return;
    
    // Initial read
    markChatAsRead(chatId);

    // Watch for unread messages (real-time updates)
    const hasUnread = chatMessages.some(m => String(m.sender_id) !== String(user.user_id) && m.status !== 'read');
    if (hasUnread) {
        markChatAsRead(chatId);
    }
  }, [chatMessages, chatId, user, markChatAsRead]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    const text = inputText;
    setInputText('');
    virtuosoRef.current?.scrollTo({ top: 10000000, behavior: 'smooth' });
    await sendMessage(chatId, text);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && chatId) {
          const file = e.target.files[0];
          setIsUploading(true);
          virtuosoRef.current?.scrollTo({ top: 10000000, behavior: 'smooth' });
          await sendImage(chatId, file);
          setIsUploading(false);
          // Reset input
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const getChatName = () => {
      if (currentChat?.type === 'group' && currentChat.name) return currentChat.name;
      return otherUser ? otherUser.username : "Chat";
  };

  const getSenderName = (senderId: string) => {
      const contact = contacts.find(c => c.user_id === senderId);
      return contact ? contact.username : 'Unknown';
  };

  const handleMessageClick = (msg: Message) => {
      if (isSelectionMode) toggleSelection(msg.message_id);
  };

  const handleLongPress = (msg: Message) => {
      if (!isSelectionMode && navigator.vibrate) navigator.vibrate(50);
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

  const confirmDelete = async () => {
      if (!chatId) return;
      await deleteMessages(chatId, Array.from(selectedMsgIds));
      setSelectedMsgIds(new Set());
  };

  const openImage = (url: string) => {
      setViewerSrc(url);
      setViewerOpen(true);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden chat-bg-pattern" style={{ height: `${viewportHeight}px` }}>
      
      {isSelectionMode ? (
        <TopBar 
            className="z-30 flex-shrink-0 bg-surface text-text-main shadow-md"
            title={`${selectedMsgIds.size} Selected`}
            onBack={() => setSelectedMsgIds(new Set())}
            actions={
                <button onClick={() => setShowDeleteModal(true)} className="p-2 text-danger bg-danger/10 rounded-full transition-colors hover:bg-danger/20">
                    <Icons.Trash />
                </button>
            }
        />
      ) : (
        <TopBar 
            className="z-30 flex-shrink-0"
            title={
            <div className="flex items-center gap-3.5">
                <Avatar name={getChatName()} size="sm" online={currentChat?.type === 'private' ? isOtherOnline : undefined} showStatus={currentChat?.type === 'private'} />
                <div className="flex flex-col">
                    <span className="text-base font-bold truncate leading-tight">{getChatName()}</span>
                    {currentChat?.type === 'private' && (
                        <span className={`text-[11px] font-medium flex items-center gap-1.5 transition-colors ${isOtherOnline ? 'text-emerald-500' : 'text-text-sub opacity-70'}`}>
                            {isOtherOnline && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
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
            const isGroup = currentChat?.type === 'group';
            const prevMsg = chatMessages[index - 1];
            const showName = isGroup && !isMe && (!prevMsg || String(prevMsg.sender_id) !== String(msg.sender_id) || showDate);
            const senderName = showName ? getSenderName(msg.sender_id) : undefined;

            return (
                <MessageItem 
                    msg={msg} isMe={isMe} showDate={showDate} 
                    onLongPress={handleLongPress} onClick={handleMessageClick}
                    isSelected={selectedMsgIds.has(msg.message_id)}
                    decryptFn={decryptContent} senderName={senderName}
                    onImageClick={openImage}
                />
            );
          }}
        />
        <ScrollDownFab onClick={() => virtuosoRef.current?.scrollTo({ top: 10000000, behavior: 'smooth' })} visible={showScrollFab} />
      </div>

      <div className="w-full pt-2 pb-2 px-3 flex-shrink-0 z-20">
        <div className="flex items-end gap-2 max-w-4xl mx-auto bg-surface/80 backdrop-blur-xl p-2 rounded-[28px] border border-white/10 shadow-lg mb-[env(safe-area-inset-bottom)]">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/*" 
                className="hidden" 
            />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="w-10 h-10 mb-[3px] ml-1 rounded-full flex items-center justify-center text-text-sub hover:bg-surface-highlight hover:text-primary transition-colors disabled:opacity-50"
            >
                {isUploading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Icons.PaperClip />}
            </button>
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 bg-transparent text-text-main text-[16px] border-none focus:ring-0 resize-none min-h-[48px] max-h-[120px] py-3 px-2 placeholder:text-text-sub/50"
                style={{ height: 'auto' }}
            />
            <button onClick={handleSend} disabled={!inputText.trim()} className={`w-12 h-12 mb-[1px] rounded-full flex items-center justify-center transition-all duration-300 ${inputText.trim() ? 'bg-primary text-white shadow-glow rotate-0' : 'bg-surface-highlight text-text-sub rotate-90 scale-90 opacity-50'}`}>
              <Icons.Send />
            </button>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Messages?"
        message={`This will permanently remove ${selectedMsgIds.size} message(s).`}
        confirmText="Delete"
        isDestructive={true}
      />
      
      <ImageViewer 
        isOpen={viewerOpen} 
        src={viewerSrc} 
        onClose={() => setViewerOpen(false)} 
      />
    </div>
  );
};

export default ChatDetail;
