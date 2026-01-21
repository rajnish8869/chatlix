
import React, { useEffect, useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { FAB, Icons, ConfirmationModal, Avatar } from '../components/AndroidUI';
import { useNavigate } from 'react-router-dom';
import { Chat, Message } from '../types';

const ChatList: React.FC = () => {
  const { chats, refreshChats, messages, contacts, loadContacts, decryptContent, deleteChats } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [decryptedPreviews, setDecryptedPreviews] = useState<Record<string, string>>({});
  
  // Selection State
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedChatIds.size > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    refreshChats();
    loadContacts();
    // eslint-disable-next-line
  }, []);

  // Async decrypt previews
  useEffect(() => {
      chats.forEach(async (chat) => {
          const lastMsg = messages[chat.chat_id]?.[messages[chat.chat_id].length - 1] || chat.last_message;
          if (lastMsg && lastMsg.type === 'encrypted' && !decryptedPreviews[lastMsg.message_id]) {
              const text = await decryptContent(chat.chat_id, lastMsg.message, lastMsg.sender_id);
              setDecryptedPreviews(prev => ({ ...prev, [lastMsg.message_id]: text }));
          }
      });
  }, [chats, messages, decryptedPreviews, decryptContent]);

  const getLastMessage = (chat: Chat): Message | undefined => {
    const localMsgs = messages[chat.chat_id];
    if (localMsgs && localMsgs.length > 0) return localMsgs[localMsgs.length - 1];
    return chat.last_message;
  };

  const getChatName = (chat: Chat) => {
      if (chat.type === 'group') return chat.name || "Group Chat";
      
      const otherId = chat.participants?.find(id => id !== user?.user_id);
      if (otherId) {
          const contact = contacts.find(c => c.user_id === otherId);
          if (contact) return contact.username;
      }
      return chat.name || "Chat";
  };

  const handleChatClick = (chatId: string) => {
      if (isSelectionMode) {
          toggleSelection(chatId);
      } else {
          navigate(`/chat/${chatId}`);
      }
  };

  const handleLongPress = (chatId: string) => {
      if (!isSelectionMode) {
          if (navigator.vibrate) navigator.vibrate(50);
      }
      toggleSelection(chatId);
  };

  const toggleSelection = (chatId: string) => {
      setSelectedChatIds(prev => {
          const next = new Set(prev);
          if (next.has(chatId)) next.delete(chatId);
          else next.add(chatId);
          return next;
      });
  };

  const handleDeleteSelected = () => {
      if (selectedChatIds.size > 0) {
          setShowDeleteModal(true);
      }
  };

  const confirmDelete = async () => {
      await deleteChats(Array.from(selectedChatIds));
      setSelectedChatIds(new Set());
  };

  const filteredChats = chats.filter(chat => getChatName(chat).toLowerCase().includes(searchQuery.toLowerCase()));

  // Long press hook wrapper component
  const ChatItemWrapper = ({ children, chatId }: { children: React.ReactNode, chatId: string }) => {
      const timerRef = useRef<any>(null);

      const start = () => {
          timerRef.current = setTimeout(() => handleLongPress(chatId), 500);
      };
      const end = () => {
          if (timerRef.current) clearTimeout(timerRef.current);
      };

      return (
          <div 
            onTouchStart={start} onTouchEnd={end} onTouchMove={end} 
            onMouseDown={start} onMouseUp={end} onMouseLeave={end}
            onClick={() => handleChatClick(chatId)}
          >
              {children}
          </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden">
      
      {/* Header Area */}
      <div className={`
         sticky top-0 z-40 pt-[env(safe-area-inset-top)] px-4 pb-2 transition-all duration-300
         ${isSelectionMode ? 'bg-surface shadow-md' : 'glass-panel'}
      `}>
          <div className="h-16 flex items-center justify-between">
              {isSelectionMode ? (
                  <div className="flex items-center gap-4 w-full">
                      <button onClick={() => setSelectedChatIds(new Set())} className="p-2 -ml-2 rounded-full hover:bg-surface-highlight">
                          <Icons.Close />
                      </button>
                      <span className="font-bold text-lg">{selectedChatIds.size} Selected</span>
                      <div className="flex-1" />
                      <button onClick={handleDeleteSelected} className="p-2 text-danger bg-danger/10 rounded-full">
                          <Icons.Trash />
                      </button>
                  </div>
              ) : (
                <>
                   {isSearchOpen ? (
                       <div className="flex items-center gap-2 w-full animate-fade-in">
                           <input 
                                autoFocus 
                                className="flex-1 bg-surface-highlight/50 rounded-xl px-4 py-2 text-text-main focus:outline-none"
                                placeholder="Search messages..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                           />
                           <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="p-2 text-text-sub"><Icons.Close /></button>
                       </div>
                   ) : (
                       <>
                        <h1 className="font-black text-2xl tracking-tight text-text-main">Messages</h1>
                        <button onClick={() => setIsSearchOpen(true)} className="p-2.5 bg-surface-highlight/50 rounded-full text-text-main hover:bg-surface-highlight transition-colors">
                            <Icons.Search />
                        </button>
                       </>
                   )}
                </>
              )}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-4 no-scrollbar">
        <div className="h-4" /> {/* Spacer */}
        {filteredChats.map(chat => {
          const lastMsg = getLastMessage(chat);
          const unread = user && lastMsg && lastMsg.sender_id !== user.user_id && lastMsg.status !== 'read';
          const chatName = getChatName(chat);
          const isSelected = selectedChatIds.has(chat.chat_id);
          
          let previewText = lastMsg?.message || '';
          if (lastMsg?.type === 'encrypted') {
              previewText = decryptedPreviews[lastMsg.message_id] || 'Encrypted message';
          }
          if (!lastMsg) previewText = 'Start a conversation';

          return (
            <ChatItemWrapper key={chat.chat_id} chatId={chat.chat_id}>
                <div 
                    className={`
                        relative mb-3 p-4 rounded-[28px] transition-all cursor-pointer flex items-center gap-4 group
                        ${isSelected 
                            ? 'bg-primary/10 ring-1 ring-primary' 
                            : 'hover:bg-surface-highlight/40 active:scale-[0.98]'
                        }
                    `}
                >
                    <div className="relative">
                        {isSelected ? (
                             <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-glow"><Icons.Check /></div>
                        ) : (
                            <Avatar name={chatName} size="md" online={chat.type === 'private' ? undefined : false} showStatus={chat.type === 'private'} />
                        )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                            <h3 className={`truncate text-[17px] ${unread ? 'font-bold text-text-main' : 'font-semibold text-text-main'}`}>{chatName}</h3>
                            <span className={`text-[11px] font-medium ${unread ? 'text-primary' : 'text-text-sub opacity-70'}`}>
                                {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {lastMsg?.sender_id === user?.user_id && (
                                <span className={`flex-shrink-0 scale-75 ${lastMsg?.status === 'read' ? 'text-primary' : 'text-text-sub'}`}>
                                    {lastMsg?.status === 'read' || lastMsg?.status === 'delivered' ? <Icons.DoubleCheck /> : <Icons.Check />}
                                </span>
                            )}
                            <p className={`text-[14px] truncate leading-relaxed ${unread ? 'text-text-main font-semibold' : 'text-text-sub opacity-80'} ${lastMsg?.type === 'encrypted' ? 'italic' : ''}`}>
                             {lastMsg?.type === 'encrypted' && <span className="mr-1 inline-block relative top-[1px]"><Icons.Lock /></span>}
                             {previewText}
                            </p>
                        </div>
                    </div>
                    {unread && <div className="w-3 h-3 bg-primary rounded-full shadow-glow" />}
                </div>
            </ChatItemWrapper>
          );
        })}
        
        {filteredChats.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-32 opacity-50 space-y-4">
                <div className="w-24 h-24 bg-surface-highlight rounded-[32px] flex items-center justify-center text-text-sub">
                    <Icons.Chat />
                </div>
                <p className="font-medium">No conversations yet</p>
            </div>
        )}
      </div>
      
      <FAB onClick={() => navigate('/new-chat')} />

      <ConfirmationModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Chats?"
        message={`This will permanently delete ${selectedChatIds.size} selected conversation(s).`}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};

export default ChatList;
