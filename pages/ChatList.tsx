
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { FAB, Icons, ConfirmationModal, Avatar, ScrollDownFab } from "../components/AndroidUI";
import { useNavigate } from "react-router-dom";
import { Chat, Message } from "../types";
import { Virtuoso } from "react-virtuoso";
import { Capacitor } from '@capacitor/core';
import { useChatStore } from "../store/chatStore";

// Extracted MessagePreview component
const MessagePreview = React.memo(({
    message,
    chatId,
    isHighlighted,
    snippet,
    decryptContent
}: {
    message: Message | undefined,
    chatId: string,
    isHighlighted: boolean,
    snippet?: string,
    decryptContent: (chatId: string, content: string, senderId: string, messageId?: string) => Promise<string>
}) => {
    const [text, setText] = useState<string>("");

    useEffect(() => {
        if (!message) {
            setText("Start a conversation");
            return;
        }

        if (isHighlighted && snippet) {
            setText(snippet);
            return;
        }

        if (message.type === 'image') {
            setText("📷 Photo");
            return;
        }
        
        if (message.type === 'audio') {
            setText("🎤 Voice Message");
            return;
        }

        if (message.type === 'encrypted') {
            let isMounted = true;
            
            decryptContent(chatId, message.message, message.sender_id, message.message_id)
                .then(decrypted => {
                    if (isMounted) setText(decrypted);
                })
                .catch(() => {
                    if (isMounted) setText("🔒 Encrypted message");
                });
            
            return () => { isMounted = false; };
        } 
        
        setText(message.message);

    }, [message?.message_id, message?.type, isHighlighted, snippet]); 

    if (isHighlighted) {
        return (
            <span className="truncate">
                Found: <span className="text-primary font-bold">{text}</span>
            </span>
        );
    }

    if (message?.type === 'encrypted') {
         return (
            <span className="flex items-center gap-1">
               <Icons.Lock className="w-2.5 h-2.5 opacity-70" />
               <span className="truncate">{text || "Decrypting..."}</span>
            </span>
         );
    }

    return <span className="truncate">{text}</span>;
});

interface ChatItemWrapperProps {
  children: React.ReactNode;
  chatId: string;
  onLongPress: (id: string) => void;
  onClick: (id: string, messageId?: string) => void;
}

const ChatItemWrapper: React.FC<ChatItemWrapperProps> = ({
  children,
  chatId,
  onLongPress,
  onClick,
}) => {
  const timerRef = useRef<any>(null);

  const start = () => {
    timerRef.current = setTimeout(() => onLongPress(chatId), 500);
  };
  const end = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div
      onTouchStart={start}
      onTouchEnd={end}
      onTouchMove={end}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
      onClick={() => onClick(chatId)}
    >
      {children}
    </div>
  );
};

type ListItem =
  | { type: "chat"; chat: Chat; id: string }
  | { type: "message"; chat: Chat; message: Message; snippet: string; id: string };

const ChatList: React.FC = () => {
  const {
    refreshChats,
    loadContacts,
    decryptContent,
    deleteChats,
    searchGlobalMessages
  } = useData();
  
  // Use Zustand Selectors
  const chats = useChatStore(state => state.chats);
  const messages = useChatStore(state => state.messages);
  const contacts = useChatStore(state => state.contacts);
  const typingStatus = useChatStore(state => state.typingStatus);

  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Keep decoupledPreviews ONLY for search caching, populated by search action
  const [decryptedPreviews, setDecryptedPreviews] = useState<
    Record<string, string>
  >({});

  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(
    new Set(),
  );
  const isSelectionMode = selectedChatIds.size > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [searchResults, setSearchResults] = useState<ListItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    refreshChats();
    loadContacts();
  }, []);

  useEffect(() => {
    const runSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const query = searchQuery.toLowerCase();
      const results: ListItem[] = [];
      const newDecrypted: Record<string, string> = {};

      // 1. Chat Name Search (Always in-memory)
      for (const chat of chats) {
        const chatName = getChatName(chat).toLowerCase();
        if (chatName.includes(query)) {
           results.push({ type: 'chat', chat, id: chat.chat_id });
        }
      }

      // 2. Message Search
      if (Capacitor.isNativePlatform()) {
          // Native SQLite Search (Scalable)
          const sqlResults = await searchGlobalMessages(query);
          
          for (const res of sqlResults) {
             const chat = chats.find(c => c.chat_id === res.message.chat_id);
             if (chat) {
                 // Check uniqueness to avoid duplicates from chat name match?
                 // Usually search results list messages under chats.
                 // Here we push message items.
                 results.push({
                     type: 'message',
                     chat,
                     message: res.message,
                     snippet: res.snippet,
                     id: `${chat.chat_id}_${res.message.message_id}`
                 });
             }
          }

      } else {
          // Web Fallback (Iterate loaded messages)
          // Note: This only searches what is currently loaded in memory state `messages`
          for (const chat of chats) {
            const localMsgs = messages[chat.chat_id] || [];
            const candidates = [...localMsgs];

            if (
              chat.last_message &&
              !localMsgs.some(
                (m) => m.message_id === chat.last_message!.message_id,
              )
            ) {
              candidates.push(chat.last_message);
            }

            candidates.sort(
              (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            );

            for (const m of candidates) {
              let text = m.message;
              if (m.type === "image") {
                text = "image";
              } else if (m.type === "encrypted") {
                if (decryptedPreviews[m.message_id]) {
                  text = decryptedPreviews[m.message_id];
                } else if (newDecrypted[m.message_id]) {
                  text = newDecrypted[m.message_id];
                } else {
                  try {
                    text = await decryptContent(
                      chat.chat_id,
                      m.message,
                      m.sender_id,
                      m.message_id
                    );
                    newDecrypted[m.message_id] = text;
                  } catch (e) {
                    text = "";
                  }
                }
              }

              if (text && text.toLowerCase().includes(query)) {
                results.push({
                  type: "message",
                  chat: chat,
                  message: m,
                  snippet: text,
                  id: `${chat.chat_id}_${m.message_id}`,
                });
              }
            }
          }
      }

      if (Object.keys(newDecrypted).length > 0) {
        setDecryptedPreviews((prev) => ({ ...prev, ...newDecrypted }));
      }

      setSearchResults(results);
      setIsSearching(false);
    };

    const debounce = setTimeout(runSearch, 500);
    return () => clearTimeout(debounce);
  }, [searchQuery, chats, messages, decryptContent, searchGlobalMessages]);

  const getLastMessage = (chat: Chat): Message | undefined => {
    const localMsgs = messages[chat.chat_id];
    if (localMsgs && localMsgs.length > 0)
      return localMsgs[localMsgs.length - 1];
    return chat.last_message;
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === "group") return chat.name || "Group Chat";

    const otherId = chat.participants?.find((id) => id !== user?.user_id);
    if (otherId) {
      const contact = contacts.find((c) => c.user_id === otherId);
      if (contact) return contact.username;
    }
    return chat.name || "Chat";
  };
  
  const getChatImage = (chat: Chat) => {
      if (chat.type === 'group') return chat.group_image;
      const otherId = chat.participants.find(id => id !== user?.user_id);
      if (otherId) {
          const contact = contacts.find(c => c.user_id === otherId);
          return contact?.profile_picture;
      }
      return undefined;
  };

  const handleItemClick = (item: ListItem) => {
    if (isSelectionMode) {
      toggleSelection(item.chat.chat_id);
    } else {
      if (item.type === "message") {
        navigate(`/chat/${item.chat.chat_id}`, {
          state: { scrollToMessageId: item.message.message_id },
        });
      } else {
        navigate(`/chat/${item.chat.chat_id}`);
      }
    }
  };

  const handleLongPress = (chatId: string) => {
    if (!isSelectionMode) {
      if (navigator.vibrate) navigator.vibrate(50);
    }
    toggleSelection(chatId);
  };

  const toggleSelection = (chatId: string) => {
    setSelectedChatIds((prev) => {
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

  const isTyping = (chatId: string) => {
    const active = typingStatus[chatId];
    if (!active) return false;
    return active.some((id) => id !== user?.user_id);
  };

  const data: ListItem[] =
    searchResults !== null
      ? searchResults
      : chats.map((c) => ({ type: "chat", chat: c, id: c.chat_id }));

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div
        className={`
         sticky top-0 z-40 pt-[env(safe-area-inset-top)] px-6 pb-4 transition-all duration-300
         ${isSelectionMode ? "bg-surface/80 backdrop-blur border-b border-primary/20" : "glass-panel border-b border-white/5"}
      `}
      >
        <div className="h-14 flex items-center justify-between">
          {isSelectionMode ? (
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setSelectedChatIds(new Set())}
                className="p-2 -ml-2 rounded-full hover:bg-surface-highlight/50 transition-colors"
              >
                <Icons.Close className="w-6 h-6" />
              </button>
              <span className="font-bold text-base text-text-main">
                {selectedChatIds.size}
              </span>
              <div className="flex-1" />
              <button
                onClick={handleDeleteSelected}
                className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors"
              >
                <Icons.Trash className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              {isSearchOpen ? (
                <div className="flex items-center gap-2 w-full animate-fade-in">
                  <div className="relative flex-1">
                    <input
                      autoFocus
                      className="w-full bg-surface border border-white/10 rounded-2xl pl-4 pr-10 py-2.5 text-sm text-text-main focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:outline-none placeholder:text-text-sub/50"
                      placeholder="Search messages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery("");
                      setSearchResults(null);
                    }}
                    className="p-2 text-text-sub hover:bg-surface-highlight/50 rounded-full transition-colors"
                  >
                    <Icons.Close className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <h1 className="font-black text-xl tracking-tight text-text-main">
                      Messages
                    </h1>
                    <p className="text-[11px] text-text-sub opacity-60 font-medium">
                      {chats.length} conversations
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2.5 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Icons.Search className="w-5 h-5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
            <div className="relative w-28 h-28 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl flex items-center justify-center">
              <Icons.Chat className="w-12 h-12 text-primary/60" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-bold text-text-main">
              {searchQuery ? "No matching messages" : "No conversations"}
            </p>
            <p className="text-sm text-text-sub opacity-70">
              {searchQuery
                ? "Try a different search term"
                : "Start a chat to begin messaging"}
            </p>
          </div>
        </div>
      ) : (
        <Virtuoso
          className="flex-1 no-scrollbar"
          data={data}
          totalCount={data.length}
          components={{ Footer: () => <div className="h-32" /> }}
          itemContent={(index, item) => {
            const chat = item.chat;
            const chatName = getChatName(chat);
            let chatImage = getChatImage(chat);
            
            const isSelected = selectedChatIds.has(chat.chat_id);
            const typing = isTyping(chat.chat_id);

            let displayTime = "";
            let highlight = false;

            // --- BLOCKING & PRESENCE LOGIC ---
            let isOnline: boolean | undefined = undefined; 
            let isBlocked: boolean = false;

            if (chat.type === 'private') {
                const otherId = chat.participants.find(p => p !== user?.user_id);
                const otherUser = contacts.find(c => c.user_id === otherId);
                
                if (otherUser) {
                     // Check if I blocked them (Black Dot)
                     const iBlockedThem = user?.blocked_users?.includes(otherUser.user_id);
                     // Check if they blocked me (Hide Status/Pic)
                     const theyBlockedMe = otherUser.blocked_users?.includes(user?.user_id || '');
                     
                     if (iBlockedThem) {
                         isBlocked = true;
                     } else if (theyBlockedMe) {
                         chatImage = undefined; // Hide Profile Pic
                         isOnline = undefined;  // Hide Status (no dot)
                     } else {
                         isOnline = otherUser.status === 'online';
                     }
                }
            } else {
                // Group chat: no status dot
                isOnline = undefined; 
            }
            // --- END BLOCKING & PRESENCE LOGIC ---

            let msgToPreview: Message | undefined;

            if (item.type === "message") {
              msgToPreview = item.message;
              displayTime = item.message.timestamp;
              highlight = true;
            } else {
              const lastMsg = getLastMessage(chat);
              if (lastMsg) {
                displayTime = lastMsg.timestamp;
                msgToPreview = lastMsg;
              }
            }

            const lastMsg = getLastMessage(chat);
            const unread =
              !highlight &&
              user &&
              lastMsg &&
              lastMsg.sender_id !== user.user_id &&
              lastMsg.status !== "read";

            return (
              <div className="px-3 py-2">
                <ChatItemWrapper
                  chatId={chat.chat_id}
                  onLongPress={handleLongPress}
                  onClick={() => handleItemClick(item)}
                >
                  <div
                    className={`
                                    relative p-3.5 rounded-[24px] transition-all active:scale-[0.98] cursor-pointer flex items-center gap-3
                                    ${
                                      isSelected
                                        ? "bg-primary/15 border-2 border-primary shadow-primary/20 shadow-lg"
                                        : "hover:bg-surface/40 border border-white/5"
                                    }
                                `}
                  >
                    <div className="relative flex-shrink-0">
                      {isSelected ? (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-glow animate-scale-in">
                          <Icons.Check className="w-5 h-5" />
                        </div>
                      ) : (
                        <Avatar
                          name={chatName}
                          src={chatImage}
                          size="md"
                          online={isOnline}
                          blocked={isBlocked}
                          showStatus={chat.type === "private" && !isBlocked && isOnline !== undefined}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2 mb-1">
                        <h3
                          className={`truncate text-[16px] ${unread ? "font-bold text-text-main" : "font-semibold text-text-main"}`}
                        >
                          {chatName}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold flex-shrink-0 ${unread ? "text-primary font-bold" : "text-text-sub opacity-60"}`}
                        >
                          {displayTime
                            ? new Date(displayTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {typing && !highlight ? (
                          <p className="text-[13px] truncate text-primary font-bold animate-pulse">
                            Typing...
                          </p>
                        ) : (
                          <>
                            {!highlight &&
                              lastMsg?.sender_id === user?.user_id && (
                                <span className="flex-shrink-0">
                                  {lastMsg?.status === "sent" && (
                                    <Icons.Check className="w-3 h-3 text-text-sub opacity-70" />
                                  )}
                                  {lastMsg?.status === "delivered" && (
                                    <Icons.DoubleCheck className="w-3 h-3 text-text-sub opacity-70" />
                                  )}
                                  {lastMsg?.status === "read" && (
                                    <Icons.DoubleCheck className="w-3 h-3 text-primary" />
                                  )}
                                </span>
                              )}
                            <p
                              className={`text-[13px] w-full flex items-center gap-1 ${unread ? "text-text-main font-semibold" : "text-text-sub opacity-70"}`}
                            >
                              <MessagePreview 
                                  message={msgToPreview}
                                  chatId={chat.chat_id}
                                  isHighlighted={highlight}
                                  snippet={item.type === 'message' ? item.snippet : undefined}
                                  decryptContent={decryptContent}
                              />
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {unread && !searchQuery && (
                      <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-glow flex-shrink-0" />
                    )}
                  </div>
                </ChatItemWrapper>
              </div>
            );
          }}
        />
      )}

      <FAB onClick={() => navigate("/new-chat")} />

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
