import React, { useEffect, useState, useRef } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { FAB, Icons, ConfirmationModal, Avatar } from "../components/AndroidUI";
import { useNavigate } from "react-router-dom";
import { Chat, Message } from "../types";
import { Virtuoso } from "react-virtuoso";

// Extracted wrapper component to avoid re-creation and fix type issues with 'key' prop
interface ChatItemWrapperProps {
  children: React.ReactNode;
  chatId: string;
  onLongPress: (id: string) => void;
  onClick: (id: string) => void;
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

const ChatList: React.FC = () => {
  const {
    chats,
    refreshChats,
    messages,
    contacts,
    loadContacts,
    decryptContent,
    deleteChats,
    typingStatus,
  } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [decryptedPreviews, setDecryptedPreviews] = useState<
    Record<string, string>
  >({});

  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(
    new Set(),
  );
  const isSelectionMode = selectedChatIds.size > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    refreshChats();
    loadContacts();
  }, []);

  useEffect(() => {
    chats.forEach(async (chat) => {
      const lastMsg =
        messages[chat.chat_id]?.[messages[chat.chat_id].length - 1] ||
        chat.last_message;
      if (
        lastMsg &&
        lastMsg.type === "encrypted" &&
        !decryptedPreviews[lastMsg.message_id]
      ) {
        const text = await decryptContent(
          chat.chat_id,
          lastMsg.message,
          lastMsg.sender_id,
        );
        setDecryptedPreviews((prev) => ({
          ...prev,
          [lastMsg.message_id]: text,
        }));
      }
    });
  }, [chats, messages, decryptedPreviews, decryptContent]);

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

  const filteredChats = chats.filter((chat) =>
    getChatName(chat).toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden">
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
                  <input
                    autoFocus
                    className="flex-1 bg-surface border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-text-main focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:outline-none placeholder:text-text-sub/50"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery("");
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
                      {filteredChats.length} conversations
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

      {filteredChats.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
            <div className="relative w-28 h-28 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl flex items-center justify-center">
              <Icons.Chat className="w-12 h-12 text-primary/60" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-bold text-text-main">No conversations</p>
            <p className="text-sm text-text-sub opacity-70">
              Start a chat to begin messaging
            </p>
          </div>
        </div>
      ) : (
        <Virtuoso
          className="flex-1 pb-32 no-scrollbar"
          data={filteredChats}
          totalCount={filteredChats.length}
          itemContent={(index, chat) => {
            const lastMsg = getLastMessage(chat);
            const unread =
              user &&
              lastMsg &&
              lastMsg.sender_id !== user.user_id &&
              lastMsg.status !== "read";
            const chatName = getChatName(chat);
            const isSelected = selectedChatIds.has(chat.chat_id);
            const typing = isTyping(chat.chat_id);

            let previewText = lastMsg?.message || "";
            if (lastMsg?.type === "encrypted") {
              previewText =
                decryptedPreviews[lastMsg.message_id] || "Encrypted message";
            }
            if (!lastMsg) previewText = "Start a conversation";
            if (lastMsg?.type === "image") previewText = "📷 Photo";

            return (
              <div className="px-3 py-2">
                <ChatItemWrapper
                  chatId={chat.chat_id}
                  onLongPress={handleLongPress}
                  onClick={handleChatClick}
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
                          size="md"
                          online={chat.type === "private" ? undefined : false}
                          showStatus={chat.type === "private"}
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
                          {lastMsg
                            ? new Date(lastMsg.timestamp).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {typing ? (
                          <p className="text-[13px] truncate text-primary font-bold animate-pulse">
                            Typing...
                          </p>
                        ) : (
                          <>
                            {lastMsg?.sender_id === user?.user_id && (
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
                              className={`text-[13px] truncate ${unread ? "text-text-main font-semibold" : "text-text-sub opacity-70"}`}
                            >
                              {lastMsg?.type === "encrypted" && (
                                <span className="mr-0.5 inline-block">
                                  <Icons.Lock className="w-2.5 h-2.5 relative bottom-[1px]" />
                                </span>
                              )}
                              {previewText}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {unread && (
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
