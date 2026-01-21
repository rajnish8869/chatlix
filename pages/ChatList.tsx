
import React, { useEffect, useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, FAB, Icons } from '../components/AndroidUI';
import { useNavigate } from 'react-router-dom';
import { Chat, Message } from '../types';

const ChatList: React.FC = () => {
  const { chats, refreshChats, syncing, messages, contacts, loadContacts, decryptContent, deleteChats } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [decryptedPreviews, setDecryptedPreviews] = useState<Record<string, string>>({});
  
  // Selection State
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedChatIds.size > 0;

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
      if (chat.type === 'group' && chat.name && chat.name !== 'New Group') return chat.name;
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
          // Trigger minimal vibration if available
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

  const handleDeleteSelected = async () => {
      if (confirm(`Delete ${selectedChatIds.size} chat(s)?`)) {
          await deleteChats(Array.from(selectedChatIds));
          setSelectedChatIds(new Set());
      }
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
            className="w-full"
          >
              {children}
          </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden">
      {isSelectionMode ? (
        <TopBar 
            title={`${selectedChatIds.size} Selected`}
            className="bg-surface text-text-main shadow-md"
            onBack={() => setSelectedChatIds(new Set())}
            actions={
                <button onClick={handleDeleteSelected} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                    <Icons.Trash />
                </button>
            }
        />
      ) : (
        <TopBar 
            title={isSearchOpen ? <input autoFocus className="w-full bg-transparent border-none focus:outline-none text-text-main" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /> : "Messages"}
            actions={!isSearchOpen ? <button onClick={() => setIsSearchOpen(true)} className="p-2 text-text-main"><Icons.Search /></button> : <button onClick={() => setIsSearchOpen(false)} className="p-2 text-text-sub"><Icons.Close /></button>}
        />
      )}

      <div className="flex-1 overflow-y-auto pb-32 pt-2 no-scrollbar pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
        {filteredChats.map(chat => {
          const lastMsg = getLastMessage(chat);
          const unread = user && lastMsg && lastMsg.sender_id !== user.user_id && lastMsg.status !== 'read';
          const chatName = getChatName(chat);
          const isSelected = selectedChatIds.has(chat.chat_id);
          
          let previewText = lastMsg?.message || '';
          if (lastMsg?.type === 'encrypted') {
              previewText = decryptedPreviews[lastMsg.message_id] || '🔒 Encrypted message';
          }
          if (!lastMsg) previewText = 'Start a conversation';

          return (
            <ChatItemWrapper key={chat.chat_id} chatId={chat.chat_id}>
                <div 
                className={`relative mb-3 p-4 rounded-[20px] transition-all cursor-pointer flex items-center gap-4 border 
                    ${isSelected ? 'bg-primary/10 border-primary' : (unread ? 'bg-surface border-border shadow-soft' : 'bg-transparent border-transparent hover:bg-surface/50')}
                `}
                >
                <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white transition-transform duration-200
                    ${isSelected ? 'bg-primary scale-90' : (unread ? 'bg-gradient-to-tr from-primary to-purple-500' : 'bg-surface-highlight text-text-sub')}
                `}>
                    {isSelected ? <Icons.Check /> : chatName.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                    <h3 className={`truncate text-[17px] ${unread ? 'font-bold' : 'font-semibold'}`}>{chatName}</h3>
                    <span className={`text-[11px] font-medium ${unread ? 'text-primary' : 'text-text-sub/70'}`}>
                        {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {lastMsg?.sender_id === user?.user_id && (
                            <span className={`flex-shrink-0 ${lastMsg?.status === 'read' ? 'text-blue-400' : 'text-text-sub'}`}>
                                {lastMsg?.status === 'read' ? <Icons.DoubleCheck /> : (lastMsg?.status === 'delivered' ? <Icons.DoubleCheck /> : <Icons.Check />)}
                            </span>
                        )}
                        <p className={`text-[14px] truncate leading-snug ${unread ? 'text-text-main font-medium' : 'text-text-sub'}`}>
                        {previewText}
                        </p>
                    </div>
                </div>
                {isSelected && <div className="absolute top-2 right-2 w-3 h-3 bg-primary rounded-full" />}
                </div>
            </ChatItemWrapper>
          );
        })}
      </div>
      <FAB onClick={() => navigate('/new-chat')} />
    </div>
  );
};

export default ChatList;
