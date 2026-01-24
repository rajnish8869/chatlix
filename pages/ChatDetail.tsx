
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
import { LinkPreview } from "../components/LinkPreview";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Message } from "../types";

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

const AudioPlayer = ({ src, isMe }: { src: string; isMe: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex items-center gap-3 min-w-[200px] py-1`}>
      <button
        onClick={(e) => {
            e.stopPropagation();
            togglePlay();
        }}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isMe ? "bg-white text-primary" : "bg-primary text-white"
        }`}
      >
        {isPlaying ? (
          <Icons.Pause className="w-5 h-5" />
        ) : (
          <Icons.Play className="w-5 h-5 ml-0.5" />
        )}
      </button>
      <div className="flex-1 flex flex-col justify-center gap-1">
        {/* Fake Waveform Visualizer */}
        <div className="flex items-center gap-0.5 h-6">
            {Array.from({ length: 20 }).map((_, i) => (
                <div 
                    key={i}
                    className={`w-1 rounded-full transition-all duration-300 ${isMe ? "bg-white/50" : "bg-primary/30"}`}
                    style={{
                        height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '30%',
                        opacity: (i / 20) * 100 < progress ? 1 : 0.5
                    }}
                />
            ))}
        </div>
        <div className={`text-[10px] font-mono ${isMe ? "text-white/80" : "text-text-sub"}`}>
             {isPlaying ? formatTime(audioRef.current?.currentTime || 0) : formatTime(duration)}
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
};

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
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (msg.type === "encrypted") {
      decryptFn(msg.chat_id, msg.message, msg.sender_id).then((decryptedText: string) => {
          setText(decryptedText);
      });
    } else {
      setText(msg.message);
    }
  }, [msg, decryptFn]);
  
  useEffect(() => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = text.match(urlRegex);
      if (match && match.length > 0) {
          setPreviewUrl(match[0]);
      } else {
          setPreviewUrl(null);
      }
  }, [text]);

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
    <div className="flex flex-col">
        <p className="text-[15px] leading-[1.5] break-words whitespace-pre-wrap">
          {content}
        </p>
        {previewUrl && (
            <LinkPreview url={previewUrl} isMe={isMe} />
        )}
    </div>
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
                relative max-w-[85%] shadow-sm active:scale-[0.98] transition-all flex flex-col
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
                      : msg.replyTo.type === "audio"
                      ? "🎤 Voice Message"
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
              ) : msg.type === "audio" ? (
                  <AudioPlayer src={msg.message} isMe={isMe} />
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
    sendAudio,
    chats,
    markChatAsRead,
    contacts,
    loadContacts,
    decryptContent,
    deleteMessages,
    toggleReaction,
    typingStatus,
    setTyping,
    unblockUser
  } = useData();

  const [inputText, setInputText] = useState("");
  const [viewportHeight, setViewportHeight] = useState(
    window.visualViewport?.height || window.innerHeight,
  );
  const [showScrollFab, setShowScrollFab] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const dragStartXRef = useRef<number | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  
  const isPressingRef = useRef(false);

  const isNative = (window as any).Capacitor?.isNative;

  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [pendingScrollTo, setPendingScrollTo] = useState<{
    id: string;
    attempts: number;
  } | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState("");

  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedMsgIds.size > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [activeMessage, setActiveMessage] = useState<Message | null>(null);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [replyPreview, setReplyPreview] = useState<string>("");

  const typingTimeoutRef = useRef<any>(null);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const chatMessages = chatId ? messages[chatId] || [] : [];
  const currentChat = chats.find((c) => c.chat_id === chatId);

  const otherUserId = currentChat?.participants.find(
    (p) => p !== user?.user_id,
  );
  const otherUser = contacts.find((c) => c.user_id === otherUserId);
  
  // --- BLOCKING LOGIC ---
  const iBlockedThem = otherUserId ? user?.blocked_users?.includes(otherUserId) : false;
  // Note: we can check if they blocked me by checking the otherUser object from contacts
  const theyBlockedMe = otherUser?.blocked_users?.includes(user?.user_id || '');
  const isBlocked = iBlockedThem || theyBlockedMe;

  // Mask status if I am blocked
  const isOtherOnline = !theyBlockedMe && otherUser?.status === "online";
  // Mask image if I am blocked
  const chatImage = theyBlockedMe 
      ? undefined 
      : (currentChat?.type === 'group' ? currentChat.group_image : otherUser?.profile_picture);

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

  useEffect(() => {
    const state = location.state as { scrollToMessageId?: string } | null;
    if (state?.scrollToMessageId) {
      setPendingScrollTo({ id: state.scrollToMessageId, attempts: 0 });
    }
  }, []);

  useEffect(() => {
    if (pendingScrollTo && chatId) {
      const index = chatMessages.findIndex(
        (m) => m.message_id === pendingScrollTo.id,
      );

      if (index !== -1) {
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index,
            align: "center",
            behavior: "auto",
          });
        }, 200);

        setHighlightedMsgId(pendingScrollTo.id);
        setPendingScrollTo(null);
        setTimeout(() => setHighlightedMsgId(null), 2500);
      } else {
        if (pendingScrollTo.attempts < 10) {
          loadMoreMessages(chatId).then(() => {
            setPendingScrollTo((prev) =>
              prev ? { ...prev, attempts: prev.attempts + 1 } : null,
            );
          });
        } else {
          setPendingScrollTo(null);
        }
      }
    }
  }, [chatMessages, pendingScrollTo, chatId, loadMoreMessages]);

  useEffect(() => {
    let isMounted = true;
    const preparePreview = async () => {
      if (!replyingTo) {
        if (isMounted) setReplyPreview("");
        return;
      }

      if (replyingTo.type === "image") {
        if (isMounted) setReplyPreview("📷 Photo");
      } else if (replyingTo.type === "audio") {
        if (isMounted) setReplyPreview("🎤 Voice Message");
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

    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    if (chatId) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(chatId, true);

      typingTimeoutRef.current = setTimeout(() => {
        setTyping(chatId, false);
      }, 3000);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    const text = inputText;

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
    if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
    }
    
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

  const startRecording = async () => {
    isPressingRef.current = true;
    setIsPreparing(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Audio recording is not supported on this device/browser.");
        setIsPreparing(false);
        isPressingRef.current = false;
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!isPressingRef.current) {
          console.log("User released button before permission granted. Aborting.");
          stream.getTracks().forEach(t => t.stop());
          setIsPreparing(false);
          return;
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      
      setIsRecording(true);
      setIsPreparing(false);
      setRecordingDuration(0);
      setDragDistance(0);

      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      setIsPreparing(false);
      isPressingRef.current = false;
      
      let errorMessage = "Microphone access error.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = "Microphone permission denied. Please enable it in settings.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = "No microphone found.";
      }
      alert(errorMessage);
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    isPressingRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const tracks = mediaRecorderRef.current?.stream.getTracks();
        tracks?.forEach(track => track.stop());

        if (shouldSend && chatId) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioBlob.size > 1000) {
              virtuosoRef.current?.scrollTo({ top: 10000000, behavior: "smooth" });
              await sendAudio(chatId, audioBlob);
          }
        }
      };
      
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setIsPreparing(false);
    setDragDistance(0);
    clearInterval(recordingTimerRef.current);
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
     if ('touches' in e) {
         dragStartXRef.current = e.touches[0].clientX;
     } else {
         dragStartXRef.current = e.clientX;
     }
     startRecording();
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
      if (!isRecording || dragStartXRef.current === null) return;
      
      let currentX;
      if ('touches' in e) {
          currentX = e.touches[0].clientX;
      } else {
          currentX = e.clientX;
      }

      const diff = dragStartXRef.current - currentX;
      if (diff > 0) {
          setDragDistance(diff);
      }

      if (diff > 150) {
          stopRecording(false);
          dragStartXRef.current = null;
      }
  };

  const handleTouchEnd = () => {
      stopRecording(true);
      dragStartXRef.current = null;
  };

  const formatDuration = (sec: number) => {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')}`;
  };

  const getChatName = () => {
    if (currentChat?.type === "group" && currentChat.name)
      return currentChat.name;
    // Mask name if I am blocked? Request says "personal details", name is usually essential to know WHO it is.
    // Keeping name for context, but masking profile pic and status.
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
      setActiveMessage(msg);
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
        } else if (activeMessage.type === "image") {
            textToCopy = "[Image]";
        } else if (activeMessage.type === "audio") {
            textToCopy = "[Audio Message]";
        }
        navigator.clipboard.writeText(textToCopy);
        break;
      case "select":
        toggleSelection(activeMessage.message_id);
        break;
      case "delete":
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
    setPendingScrollTo({ id: msgId, attempts: 0 });
  };

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
                src={chatImage} // Masked if blocked
                size="sm"
                online={currentChat?.type === "private" ? isOtherOnline : undefined}
                blocked={iBlockedThem}
                showStatus={currentChat?.type === "private" && !iBlockedThem && !theyBlockedMe}
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
                  currentChat?.type === "private" && !theyBlockedMe && !iBlockedThem && (
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
        {isBlocked ? (
            // --- BLOCKED STATE FOOTER ---
            <div className="max-w-5xl mx-auto bg-surface/70 backdrop-blur-xl border border-white/10 shadow-lg rounded-[24px] mb-[env(safe-area-inset-bottom)] p-4 flex flex-col items-center justify-center text-center gap-2 animate-slide-up">
                <span className="text-sm font-bold text-text-sub">
                    {iBlockedThem ? "You blocked this user." : "You have been blocked by this user."}
                </span>
                {iBlockedThem && otherUserId && (
                    <button 
                        onClick={() => unblockUser(otherUserId)}
                        className="text-xs font-bold text-primary hover:underline"
                    >
                        Tap to Unblock
                    </button>
                )}
            </div>
        ) : (
            // --- NORMAL INPUT FOOTER ---
            <>
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
                className={`relative max-w-5xl mx-auto bg-surface/70 backdrop-blur-xl border border-white/10 shadow-lg mb-[env(safe-area-inset-bottom)] transition-all overflow-hidden ${replyingTo ? "rounded-b-[24px] rounded-t-none border-t-0" : "rounded-[24px]"}`}
                >
                {isRecording && (
                    <div className="absolute inset-0 z-30 bg-surface flex items-center justify-between px-4 animate-fade-in">
                        <div className="flex items-center gap-2 text-danger animate-pulse">
                            <div className="w-2.5 h-2.5 rounded-full bg-danger" />
                            <span className="font-mono font-bold text-sm">{formatDuration(recordingDuration)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-text-sub text-xs font-bold uppercase tracking-wide opacity-80">
                            <Icons.Trash className="w-4 h-4" />
                            <span>Slide to Cancel</span>
                        </div>
                    </div>
                )}

                <div className={`flex items-end gap-2 p-2 ${isRecording ? 'opacity-0' : 'opacity-100'}`}>
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
                        ref={textareaRef}
                        value={inputText}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 bg-transparent text-text-main text-[15px] border-none focus:ring-0 resize-none min-h-[40px] max-h-[120px] py-[9px] px-2 placeholder:text-text-sub/40 font-medium leading-relaxed"
                        style={{ height: "40px" }}
                    />
                    
                    {inputText.trim() || !isNative ? (
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim()}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${inputText.trim() ? "bg-primary text-white shadow-glow scale-100" : "bg-surface-highlight text-text-sub opacity-50 cursor-not-allowed"}`}
                        >
                            <Icons.Send className="w-5 h-5 ml-0.5" />
                        </button>
                    ) : (
                        <div 
                            className="relative"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={handleTouchStart}
                            onMouseUp={handleTouchEnd}
                            onMouseMove={handleTouchMove}
                            onMouseLeave={handleTouchEnd}
                        >
                            <button 
                                type="button"
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 
                                    ${isRecording ? "bg-danger scale-125 shadow-lg shadow-danger/40 text-white" : 
                                    isPreparing ? "bg-surface-highlight scale-90 opacity-80 text-primary" :
                                    "bg-surface-highlight text-text-sub hover:bg-primary/10 hover:text-primary"}`}
                                style={{ touchAction: 'none' }}
                            >
                                <Icons.Mic className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
                </div>
            </>
        )}
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
