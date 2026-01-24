
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { TopBar, Icons, Avatar } from "../components/AndroidUI";

const ChatInfo: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { chats, contacts, loadContacts } = useData();
  const { user } = useAuth();

  const currentChat = chats.find((c) => c.chat_id === chatId);

  const participants =
    currentChat?.participants.map((id) => {
      const contact = contacts.find((u) => u.user_id === id);
      if (id === user?.user_id) return { ...user, isMe: true };
      return (
        contact || {
          user_id: id,
          username: "Unknown User",
          status: "offline",
          isMe: false,
        }
      );
    }) || [];

  useEffect(() => {
    loadContacts();
  }, []);

  if (!currentChat)
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-surface rounded-full mx-auto flex items-center justify-center">
            <Icons.Chat className="w-8 h-8 text-text-sub opacity-50" />
          </div>
          <p className="text-text-sub font-medium">Chat not found</p>
        </div>
      </div>
    );

  return (
    <div className="flex-1 bg-background text-text-main h-full flex flex-col overflow-hidden">
      <TopBar
        title="Chat Details"
        onBack={() => navigate(-1)}
        className="border-b border-white/5"
      />

      <div className="flex-1 overflow-y-auto pb-10 min-h-0">
        <div className="flex flex-col items-center pt-8 pb-10 px-6 relative">
          <div className="relative mb-6 transform hover:scale-110 transition-transform duration-500">
            <Avatar
              name={currentChat.name || "C"}
              size="xl"
              className="shadow-2xl shadow-primary/30"
              showStatus={false}
            />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-center mb-2">
            {currentChat.name || "Conversation"}
          </h2>
          <span className="px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full text-xs font-bold text-primary tracking-wide uppercase">
            {currentChat.type === "group"
              ? "Group Conversation"
              : "Private Chat"}
          </span>
        </div>

        <div className="px-5 max-w-2xl mx-auto">
          <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest mb-4 ml-1 opacity-70">
            Members ({participants.length})
          </h3>
          <div className="bg-surface rounded-[28px] border border-white/10 overflow-hidden shadow-md">
            {participants.map((p: any, idx) => (
              <div
                key={p.user_id}
                className={`flex items-center gap-3.5 p-5 ${idx !== participants.length - 1 ? "border-b border-white/5" : ""} hover:bg-surface-highlight/20 transition-colors`}
              >
                <Avatar
                  name={p.username}
                  src={p.profile_picture}
                  size="md"
                  online={p.status === "online"}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-bold text-text-main truncate">
                      {p.username}
                    </h4>
                    {p.isMe && (
                      <span className="text-[10px] bg-primary/20 text-primary px-2.5 py-0.5 rounded-full font-bold flex-shrink-0">
                        YOU
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-sub opacity-70 truncate">
                    {p.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInfo;
