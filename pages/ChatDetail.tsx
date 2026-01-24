
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import {
  TopBar,
  Icons,
  ScrollDownFab,
  ConfirmationModal,
  Avatar,
  ImageViewer,
  BottomSheet,
} from "../components/AndroidUI";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Message } from "../types";

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

const MessageContent = ({
  msg,
  isMe,
  decryptFn,
}: {
  msg: Message;
  isMe: boolean;
  decryptFn: any;
}) => {
  const [text, setText] = useState(
    msg.type === "encrypted" ? "🔓 Decrypting..." : msg.message,
  );

  useEffect(() => {
    if (msg.type === "encrypted") {
      decryptFn(msg.chat_id, msg.message, msg.sender_id).then(setText);
    } else {
      setText(msg.message);
    }
  }, [msg, decryptFn]);

  const content = React.useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all relative z-10 font-medium ${isMe ? 'text-white decoration-white/70' : 'text-blue-500 decoration-blue-500/30'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  }, [text, isMe]);

  return (
    <p className="text-[15px] leading-[1.5] break-words whitespace-pre-wrap">
      {content}
    </p>
  );
};

interface SwipeableMessageProps {
  children: React.ReactNode;
  onReply: () => void;
  isMe: boolean;
}

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({
  children,
  onReply,
  isMe,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const startX = useRef<number | null>(null);
  const threshold = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const diff = e.touches[0].clientX - startX.current;

    // Only allow swiping right
    if (diff > 0 && diff < 100) {
      setTranslateX(diff);
    }
  };

  const handleTouchEnd = () => {
    if (translateX > threshold) {
      if (navigator.vibrate) navigator.vibrate(50);
      onReply();
    }
    setTranslateX(0);
    startX.current = null;
  };

  return (
    <div
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="absolute left-[-40px] top-1/2 -translate-y-1/2 transition-opacity duration-200 text-primary"
        style={{
          opacity: Math.min(translateX / threshold, 1),
          transform: `translateY(-50%) scale(${Math.min(translateX / threshold, 1)})`,
        }}
      >
        <div className="bg-surface-highlight p-2 rounded-full shadow-sm">
          <Icons.Reply className="w-5 h-5" />
        </div>
      </div>
      <div
        className="transition-transform duration-200 ease-out will-change-transform"
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

const MessageItem = React.memo(
  ({
    msg,
    isMe,
    showDate,
    onLongPress,
    onClick,
    isSelected,
    decryptFn,
    senderName,
    onImageClick,
    onReply,
    onScrollTo,
    isHighlighted,
  }: {
    msg: Message;
    isMe: boolean;
    showDate: boolean;
    onLongPress: (msg: Message) => void;
    onClick: (msg: Message) => void;
    isSelected: boolean;
    decryptFn: any;
    senderName?: string;
    onImageClick: (url: string) => void;
    onReply: (msg: Message) => void;
    onScrollTo: (id: string) => void;
    isHighlighted: boolean;
  }) => {
    const touchTimer = useRef<any>(undefined);

    const handleTouchStart = () => {
      touchTimer.current = setTimeout(() => onLongPress(msg), 400);
    };
    const handleTouchEnd = () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    };

    // Aggregate reactions
    const reactionCounts = React.useMemo(() => {
      if (!msg.reactions) return null;
      const counts: Record<string, number> = {};
      Object.values(msg.reactions).forEach((r) => {
        counts[r] = (counts[r] || 0) + 1;
      });
      const entries = Object.entries(counts);
      if (entries.length === 0) return null;
      return entries;
    }, [msg.reactions]);

    return (
      <SwipeableMessage onReply={() => onReply(msg)} isMe={isMe}>
        <div
          className={`px-3 animate-fade-in transition-all duration-300 ${isSelected ? "bg-primary/10 -mx-3 px-6 py-2 rounded-xl" : ""}`}
        >
          {showDate && (
            <div className="flex justify-center py-4">
              <span className="text-[10px] font-bold tracking-widest text-text-sub bg-surface/60 backdrop-blur border border-white/5 px-3 py-1 rounded-full shadow-sm">
                {new Date(msg.timestamp)
                  .toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                  .toUpperCase()}
              </span>
            </div>
          )}
          <div
            className={`flex flex-col mb-2 ${isMe ? "items-end" : "items-start"} transition-all duration-700 ${isHighlighted ? "scale-105" : ""}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onClick={() => onClick(msg)}
          >
            {senderName && (
              <span className="text-[11px] font-bold mb-1.5 ml-3 text-primary opacity-90">
                {senderName}
              </span>
            )}

            <div
              className={`
                relative max-w-[80%] shadow-sm active:scale-[0.98] transition-all flex flex-col
                ${
                  isMe
                    ? "bg-gradient-to-br from-primary to-primary/80 text-white rounded-[20px] rounded-tr-none shadow-primary/20"
                    : "bg-surface text-text-main rounded-[20px] rounded-tl-none border border-white/10"
                } 
                ${msg.status === "failed" ? "border-2 border-danger" : ""}
                ${msg.type === "image" ? "p-1" : "px-4 py-3"} 
                ${reactionCounts ? "mb-6" : ""}
                ${isHighlighted ? "ring-2 ring-primary shadow-[0_0_30px_rgba(var(--primary-color),0.4)]" : ""}
            `}
            >
              {msg.replyTo && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onScrollTo(msg.replyTo!.message_id);
                  }}
                  className={`
                        mb-2 rounded-lg p-2 border-l-4 cursor-pointer text-xs
                        ${isMe ? "bg-black/20 border-white/30" : "bg-surface-highlight border-primary/50"}
                    `}
                >
                  <span className="font-bold block mb-0.5 opacity-90 text-[10px]">
                    Reply
                  </span>
                  <span className="opacity-80 line-clamp-1 truncate">
                    {msg.replyTo.type === "image"
                      ? "📷 Photo"
                      : msg.replyTo.message}
                  </span>
                </div>
              )}

              {msg.type === "image" ? (
                <img
                  src={msg.message}
                  alt="Attachment"
                  className="rounded-[18px] max-w-full h-auto cursor-pointer"
                  style={{ maxHeight: "300px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageClick(msg.message);
                  }}
                />
              ) : (
                <MessageContent msg={msg} isMe={isMe} decryptFn={decryptFn} />
              )}

              <div
                className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${isMe ? "text-white/70" : "text-text-sub/70"} ${msg.type === "image" ? "pr-2 pb-1" : ""}`}
              >
                <span className="font-medium">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {isMe && (
                  <span className="flex items-center gap-0.5">
                    {msg.status === "pending" && (
                      <div className="w-2 h-2 rounded-full border-[1.5px] border-white/50 border-t-white animate-spin" />
                    )}
                    {msg.status === "sent" && (
                      <Icons.Check className="w-3 h-3 text-white/60" />
                    )}
                    {msg.status === "delivered" && (
                      <Icons.DoubleCheck className="w-3 h-3 text-white/60" />
                    )}
                    {msg.status === "read" && (
                      <Icons.DoubleCheck className="w-3 h-3 text-cyan-300" />
                    )}
                  </span>
                )}
                {msg.type === "encrypted" && (
                  <Icons.Lock className="w-2.5 h-2.5 opacity-70" />
                )}
              </div>

              {reactionCounts && (
                <div
                  className={`absolute -bottom-3 ${isMe ? "right-2" : "left-2"} flex items-center gap-1 flex-wrap z-10 max-w-full`}
                >
                  {reactionCounts.map(([emoji, count]) => (
                    <div
                      key={emoji}
                      className="bg-surface border border-white/10 shadow-md rounded-full px-2 py-0.5 text-[11px] flex items-center gap-0.5 text-text-main"
                    >
                      <span>{emoji}</span>
                      {count > 1 && <span className="font-bold">{count}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SwipeableMessage>
    );
  },
);

const ChatDetail: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    messages,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    sendImage,
    chats,
    markChatAsRead,
    contacts,
    loadContacts,
    decryptContent,
    deleteMessages,
    toggleReaction,
    typingStatus,
    setTyping,
  } = useData();

  const [inputText, setInputText] = useState("");
  const [viewportHeight, setViewportHeight] = useState(
    window.visualViewport?.height || window.innerHeight,
  );
  const [showScrollFab, setShowScrollFab] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Scroll & Highlight State
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [pendingScrollTo, setPendingScrollTo] = useState<{
    id: string;
    attempts: number;
  } | null>(null);

  // Image Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState("");

  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedMsgIds.size > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Reaction / Options Sheet State
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);

  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [replyPreview, setReplyPreview] = useState<string>("");

  // Typing Throttling
  const typingTimeoutRef = useRef<any>(null);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const chatMessages = chatId ? messages[chatId] || [] : [];
  const currentChat = chats.find((c) => c.chat_id === chatId);

  const otherUserId = currentChat?.participants.find(
    (p) => p !== user?.user_id,
  );
  const otherUser = contacts.find((c) => c.user_id === otherUserId);
  const isOtherOnline = otherUser?.status === "online";
  
  const chatImage = currentChat?.type === 'private' ? otherUser?.profile_picture : undefined;

  useEffect(() => {
    const handleResize = () =>
      setViewportHeight(window.visualViewport?.height || window.innerHeight);
    window.visualViewport?.addEventListener("resize", handleResize);
    return () =>
      window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      loadContacts();
    }
  }, [chatId, loadMessages, loadContacts]);

  useEffect(() => {
    if (!chatId || !user) return;
    markChatAsRead(chatId);
    const hasUnread = chatMessages.some(
      (m) =>
        String(m.sender_id) !== String(user.user_id) && m.status !== "read",
    );
    if (hasUnread) {
      markChatAsRead(chatId);
    }
  }, [chatMessages, chatId, user, markChatAsRead]);

  // Check for scroll-to request from navigation state
  useEffect(() => {
    const state = location.state as { scrollToMessageId?: string } | null;
    if (state?.scrollToMessageId) {
      setPendingScrollTo({ id: state.scrollToMessageId, attempts: 0 });
    }
  }, []); // Run once on mount

  // Handle Pending Scroll (Recursive Load)
  useEffect(() => {
    if (pendingScrollTo && chatId) {
      const index = chatMessages.findIndex(
        (m) => m.message_id === pendingScrollTo.id,
      );

      if (index !== -1) {
        // Found it!
        // Use timeout to ensure Virtuoso is ready and rendered.
        // Use 'auto' behavior for instant jump on load.
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index,
            align: "center",
            behavior: "auto",
          });
        }, 200);

        setHighlightedMsgId(pendingScrollTo.id);
        setPendingScrollTo(null);
        // Remove highlight after animation
        setTimeout(() => setHighlightedMsgId(null), 2500);
      } else {
        // Not found yet
        if (pendingScrollTo.attempts < 10) {
          // Try loading more
          loadMoreMessages(chatId).then(() => {
            setPendingScrollTo((prev) =>
              prev ? { ...prev, attempts: prev.attempts + 1 } : null,
            );
          });
        } else {
          // Give up after enough tries
          setPendingScrollTo(null);
        }
      }
    }
  }, [chatMessages, pendingScrollTo, chatId, loadMoreMessages]);

  // Decrypt reply preview on selection
  useEffect(() => {
    let isMounted = true;
    const preparePreview = async () => {
      if (!replyingTo) {
        if (isMounted) setReplyPreview("");
        return;
      }

      if (replyingTo.type === "image") {
        if (isMounted) setReplyPreview("📷 Photo");
      } else if (replyingTo.type === "encrypted") {
        try {
          const text = await decryptContent(
            chatId!,
            replyingTo.message,
            replyingTo.sender_id,
          );
          if (isMounted) setReplyPreview(text);
        } catch (e) {
          if (isMounted) setReplyPreview("Encrypted Message");
        }
      } else {
        if (isMounted) setReplyPreview(replyingTo.message);
      }
    };
    preparePreview();
    return () => {
      isMounted = false;
    };
  }, [replyingTo, chatId, decryptContent]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (chatId) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(chatId, true);

      typingTimeoutRef.current = setTimeout(() => {
        setTyping(chatId, false);
      }, 3000); // Stop typing after 3s of inactivity
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    const text = inputText;

    // Construct replyTo object if replying
    let replyPayload = undefined;
    if (replyingTo) {
      replyPayload = {
        message_id: replyingTo.message_id,
        sender_id: replyingTo.sender_id,
        message: replyPreview.substring(0, 100),
        type: replyingTo.type,
      };
    }

    setInputText("");
    setReplyingTo(null);
    setReplyPreview("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping(chatId, false);

    virtuosoRef.current?.scrollTo({ top: 10000000, behavior: "smooth" });

    await sendMessage(chatId, text, replyPayload);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && chatId) {
      const file = e.target.files[0];
      setIsUploading(true);
      virtuosoRef.current?.scrollTo({ top: 10000000, behavior: "smooth" });
      await sendImage(chatId, file);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getChatName = () => {
    if (currentChat?.type === "group" && currentChat.name)
      return currentChat.name;
    return otherUser ? otherUser.username : "Chat";
  };

  const getSenderName = (senderId: string) => {
    const contact = contacts.find((c) => c.user_id === senderId);
    return contact ? contact.username : "Unknown";
  };

  const handleMessageClick = (msg: Message) => {
    if (isSelectionMode) toggleSelection(msg.message_id);
  };

  const handleLongPress = (msg: Message) => {
    if (!isSelectionMode) {
      if (navigator.vibrate) navigator.vibrate(50);
      setActiveMessage(msg); // Open options instead of direct select
    } else {
      toggleSelection(msg.message_id);
    }
  };

  const toggleSelection = (msgId: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleReaction = async (emoji: string) => {
    if (activeMessage && chatId) {
      await toggleReaction(chatId, activeMessage.message_id, emoji);
      setActiveMessage(null);
    }
  };

  const handleMenuAction = async (
    action: "reply" | "copy" | "select" | "delete",
  ) => {
    if (!activeMessage || !chatId) return;

    switch (action) {
      case "reply":
        setReplyingTo(activeMessage);
        break;
      case "copy":
        let textToCopy = activeMessage.message;
        if (activeMessage.type === "encrypted") {
          try {
            textToCopy = await decryptContent(
              chatId,
              activeMessage.message,
              activeMessage.sender_id,
            );
          } catch (e) {
            console.error("Failed to decrypt for copy", e);
            textToCopy = "Decryption failed";
          }
        }
        navigator.clipboard.writeText(textToCopy);
        break;
      case "select":
        toggleSelection(activeMessage.message_id);
        break;
      case "delete":
        // Special handling for delete flow
        setSelectedMsgIds(new Set([activeMessage.message_id]));
        setShowDeleteModal(true);
        break;
    }
    setActiveMessage(null);
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

  const handleReplyFromSelection = () => {
    if (selectedMsgIds.size !== 1) return;
    const msgId = Array.from(selectedMsgIds)[0];
    const msg = chatMessages.find((m) => m.message_id === msgId);
    if (msg) setReplyingTo(msg);
    setSelectedMsgIds(new Set());
  };

  const scrollToMessage = (msgId: string) => {
    // Initiate search sequence
    setPendingScrollTo({ id: msgId, attempts: 0 });
  };

  // Determine typing string
  const getTypingText = () => {
    if (!chatId || !typingStatus[chatId]) return null;
    const activeUserIds = typingStatus[chatId].filter(
      (id) => id !== user?.user_id,
    );

    if (activeUserIds.length === 0) return null;

    if (currentChat?.type === "private") {
      return "Typing...";
    }

    if (activeUserIds.length === 1) {
      const name =
        contacts.find((c) => c.user_id === activeUserIds[0])?.username ||
        "Someone";
      return `${name} is typing...`;
    }

    return `${activeUserIds.length} people are typing...`;
  };

  const typingText = getTypingText();

  return (
    <div
      className="fixed inset-0 flex flex-col bg-background overflow-hidden"
      style={{ height: `${viewportHeight}px` }}
    >
      {isSelectionMode ? (
        <TopBar
          className="z-30 flex-shrink-0 bg-surface/80 backdrop-blur border-b border-primary/20"
          title={`${selectedMsgIds.size} selected`}
          onBack={() => setSelectedMsgIds(new Set())}
          actions={
            <div className="flex items-center gap-2">
              {selectedMsgIds.size === 1 && (
                <button
                  onClick={handleReplyFromSelection}
                  className="p-2.5 rounded-full text-primary hover:bg-primary/10 transition-colors"
                >
                  <Icons.Reply className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2.5 rounded-full text-danger hover:bg-danger/10 transition-colors"
              >
                <Icons.Trash className="w-5 h-5" />
              </button>
            </div>
          }
        />
      ) : (
        <TopBar
          className="z-30 flex-shrink-0 border-b border-white/5"
          title={
            <div className="flex items-center gap-2.5">
              <Avatar
                name={getChatName()}
                src={chatImage}
                size="sm"
                online={
                  currentChat?.type === "private" ? isOtherOnline : undefined
                }
                showStatus={currentChat?.type === "private"}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-bold truncate">
                  {getChatName()}
                </span>
                {typingText ? (
                  <span className="text-[10px] font-bold text-primary animate-pulse leading-none">
                    {typingText}
                  </span>
                ) : (
                  currentChat?.type === "private" && (
                    <span
                      className={`text-[10px] font-semibold flex items-center gap-1 leading-none ${isOtherOnline ? "text-emerald-500" : "text-text-sub opacity-60"}`}
                    >
                      {isOtherOnline && (
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                      {isOtherOnline ? "Online" : "Offline"}
                    </span>
                  )
                )}
              </div>
            </div>
          }
          onBack={() => navigate("/")}
          onClickTitle={() => navigate(`/chat/${chatId}/info`)}
        />
      )}

      <div className="flex-1 min-h-0 relative">
        <Virtuoso
          ref={virtuosoRef}
          data={chatMessages}
          initialTopMostItemIndex={Math.max(0, chatMessages.length - 1)}
          alignToBottom
          startReached={() => {
            if (chatId) loadMoreMessages(chatId);
          }}
          overscan={500}
          atBottomStateChange={(atBottom) => setShowScrollFab(!atBottom)}
          followOutput={(isAtBottom) => {
            // If we are actively highlighting a message (from search), don't force scroll to bottom
            if (highlightedMsgId) return false;

            const lastMsg = chatMessages[chatMessages.length - 1];
            if (lastMsg && String(lastMsg.sender_id) === String(user?.user_id))
              return "smooth";
            return isAtBottom ? "smooth" : false;
          }}
          itemContent={(index, msg) => {
            const isMe = String(msg.sender_id) === String(user?.user_id);
            const showDate =
              index === 0 ||
              msg.timestamp.substring(0, 10) !==
                chatMessages[index - 1]?.timestamp.substring(0, 10);
            const isGroup = currentChat?.type === "group";
            const prevMsg = chatMessages[index - 1];
            const showName =
              isGroup &&
              !isMe &&
              (!prevMsg ||
                String(prevMsg.sender_id) !== String(msg.sender_id) ||
                showDate);
            const senderName = showName
              ? getSenderName(msg.sender_id)
              : undefined;

            return (
              <MessageItem
                msg={msg}
                isMe={isMe}
                showDate={showDate}
                onLongPress={handleLongPress}
                onClick={handleMessageClick}
                isSelected={selectedMsgIds.has(msg.message_id)}
                decryptFn={decryptContent}
                senderName={senderName}
                onImageClick={openImage}
                onReply={setReplyingTo}
                onScrollTo={scrollToMessage}
                isHighlighted={highlightedMsgId === msg.message_id}
              />
            );
          }}
        />
        <ScrollDownFab
          onClick={() =>
            virtuosoRef.current?.scrollTo({ top: 10000000, behavior: "smooth" })
          }
          visible={showScrollFab}
        />

        {pendingScrollTo && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-primary/20 flex items-center gap-2 z-50 animate-fade-in">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] font-bold text-text-main">
              Locating message...
            </span>
          </div>
        )}
      </div>

      <div className="w-full pt-1 pb-2 px-3 flex-shrink-0 z-20">
        {replyingTo && (
          <div className="max-w-5xl mx-auto bg-gradient-to-r from-surface/90 to-surface/70 backdrop-blur-lg border border-primary/20 rounded-t-3xl p-3 flex items-center justify-between mb-[-8px] pb-5 shadow-lg animate-slide-up">
            <div className="flex flex-col border-l-4 border-primary pl-3 flex-1 min-w-0">
              <span className="text-primary font-bold text-[11px] mb-0.5">
                Replying to {getSenderName(replyingTo.sender_id)}
              </span>
              <span className="text-text-sub text-sm truncate">
                {replyPreview}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-2 text-text-sub hover:bg-primary/10 rounded-full transition-colors flex-shrink-0"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
          </div>
        )}

        <div
          className={`flex items-end gap-2 max-w-5xl mx-auto bg-surface/70 backdrop-blur-xl p-2 border border-white/10 shadow-lg mb-[env(safe-area-inset-bottom)] transition-all ${replyingTo ? "rounded-b-[24px] rounded-t-none border-t-0" : "rounded-[24px]"}`}
        >
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
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-sub hover:bg-primary/20 hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icons.PaperClip className="w-5 h-5" />
            )}
          </button>
          <textarea
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent text-text-main text-[15px] border-none focus:ring-0 resize-none min-h-[44px] max-h-[100px] py-2.5 px-1 placeholder:text-text-sub/40 font-medium"
            style={{ height: "auto" }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${inputText.trim() ? "bg-primary text-white shadow-glow scale-100" : "bg-surface-highlight text-text-sub opacity-40"}`}
          >
            <Icons.Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete messages?"
        message={`Remove ${selectedMsgIds.size} message(s) permanently?`}
        confirmText="Delete"
        isDestructive={true}
      />

      <ImageViewer
        isOpen={viewerOpen}
        src={viewerSrc}
        onClose={() => setViewerOpen(false)}
      />

      <BottomSheet
        isOpen={!!activeMessage}
        onClose={() => setActiveMessage(null)}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-6 gap-2 px-1">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className={`
                            text-3xl p-2 rounded-2xl transition-all hover:scale-110 flex items-center justify-center
                            ${activeMessage?.reactions?.[user?.user_id || ""] === emoji ? "bg-primary/30 scale-100" : "hover:bg-surface-highlight"}
                        `}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="w-full h-px bg-white/5" />

          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => handleMenuAction("reply")}
              className="flex items-center gap-3 p-3.5 rounded-2xl hover:bg-primary/10 transition-colors text-text-main font-semibold"
            >
              <Icons.Reply className="w-5 h-5 text-primary" />
              Reply
            </button>
            <button
              onClick={() => handleMenuAction("copy")}
              className="flex items-center gap-3 p-3.5 rounded-2xl hover:bg-surface-highlight transition-colors text-text-main font-semibold"
            >
              <Icons.PaperClip className="w-5 h-5 text-text-sub" />
              Copy
            </button>
            <button
              onClick={() => handleMenuAction("select")}
              className="flex items-center gap-3 p-3.5 rounded-2xl hover:bg-primary/10 transition-colors text-text-main font-semibold"
            >
              <Icons.Check className="w-5 h-5 text-primary" />
              Select
            </button>
            {activeMessage?.sender_id === user?.user_id && (
              <button
                onClick={() => handleMenuAction("delete")}
                className="flex items-center gap-3 p-3.5 rounded-2xl hover:bg-danger/10 transition-colors text-danger font-semibold"
              >
                <Icons.Trash className="w-5 h-5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

export default ChatDetail;
