
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import {
  TopBar,
  Icons,
  BottomSheet,
  Input,
  Button,
  Avatar,
} from "../components/AndroidUI";

const NewChat: React.FC = () => {
  const { contacts, loadContacts, createChat } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showNameModal, setShowNameModal] = useState(false);
  const [groupName, setGroupName] = useState("");

  const groupsEnabled = user?.enable_groups ?? true;

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line
  }, []);

  const toggleSelection = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(userId)) {
        next.delete(userId);
      } else {
        // If groups are disabled, ensure we only select one person (Single Select Mode)
        if (!groupsEnabled) {
          next.clear();
        }
        next.add(userId);
      }
      return next;
    });
  };

  const handleFabClick = () => {
    if (selectedIds.size === 0) return;

    // Double check constraint
    if (selectedIds.size > 1 && !groupsEnabled) {
      createConversation();
      return;
    }

    if (selectedIds.size > 1) {
      setGroupName("");
      setShowNameModal(true);
    } else {
      createConversation();
    }
  };

  const createConversation = async (name?: string) => {
    setLoading(true);
    setShowNameModal(false);
    const chatId = await createChat(Array.from(selectedIds), name);
    setLoading(false);
    if (chatId) {
      navigate(`/chat/${chatId}`, { replace: true });
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.username.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="flex-1 bg-background text-text-main h-full flex flex-col overflow-hidden">
      <TopBar
        title={
          selectedIds.size > 0 ? `${selectedIds.size} selected` : "New Chat"
        }
        onBack={() => navigate(-1)}
        actions={
          selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-bold text-primary bg-primary/10 px-3.5 py-2 rounded-full hover:bg-primary/20 transition-colors"
            >
              Reset
            </button>
          )
        }
        className="border-b border-white/5"
      />

      <div className="px-4 py-3 sticky top-16 z-20 bg-background/95 backdrop-blur-xl border-b border-white/5">
        <div className="relative">
          <Input
            autoFocus
            placeholder="Search contacts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-surface border-white/5"
          />
        </div>
      </div>

      <div className="flex-1 px-3 pb-28 pt-3 overflow-y-auto no-scrollbar min-h-0">
        {!groupsEnabled && (
          <div className="bg-amber-500/10 border-l-4 border-amber-500 rounded-r-xl p-4 mb-6 shadow-sm">
            <h4 className="text-sm font-bold text-text-main mb-1">
              Single Chat Mode
            </h4>
            <p className="text-xs text-text-sub opacity-80">
              You can only select one contact at a time.
            </p>
          </div>
        )}

        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-16 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
              <div className="relative w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center">
                <Icons.Chat className="w-10 h-10 text-primary/50" />
              </div>
            </div>
            <p className="text-text-sub opacity-70 text-sm font-medium">
              No contacts found
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-xs text-text-sub font-bold mb-3 uppercase tracking-widest ml-2 opacity-60">
              {filteredContacts.length} Contacts
            </h2>
            {filteredContacts.map((contact) => {
              const isSelected = selectedIds.has(contact.user_id);
              
              // Blocking Logic
              const isBlockedByMe = user?.blocked_users?.includes(contact.user_id);
              const isBlockedByThem = contact.blocked_users?.includes(user?.user_id || '');
              
              // Determine display values
              const avatarSrc = isBlockedByThem ? undefined : contact.profile_picture;
              const isOnline = isBlockedByThem ? undefined : (contact.status === 'online');
              
              // If blocked by them, don't show black dot (that's for when I block them).
              // Just show no status.
              // If blocked by me, show black dot (isBlockedByMe is passed as 'blocked').
              
              const statusText = isBlockedByThem 
                  ? "User unavailable" 
                  : isBlockedByMe 
                      ? "Blocked" 
                      : contact.status;

              const isDisabled = isBlockedByThem;

              return (
                <div
                  key={contact.user_id}
                  onClick={() => !isDisabled && toggleSelection(contact.user_id)}
                  className={`
                            flex items-center gap-3 p-3.5 rounded-[24px] transition-all border
                            ${isDisabled 
                                ? "opacity-50 cursor-not-allowed bg-surface/20 border-transparent" 
                                : "cursor-pointer active:scale-[0.98] hover:bg-surface/60"
                            }
                            ${isSelected
                                ? "bg-primary/15 border-primary/40 shadow-primary/20 shadow-md"
                                : "border-transparent"
                            }
                        `}
                >
                  <Avatar
                    name={contact.username}
                    src={avatarSrc}
                    size="md"
                    online={isOnline}
                    blocked={isBlockedByMe}
                  />
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-bold text-base ${isSelected ? "text-primary" : "text-text-main"}`}
                    >
                      {contact.username}
                    </h3>
                    <p className={`text-xs font-medium opacity-70 ${isBlockedByThem ? "text-text-sub italic" : "text-text-sub"}`}>
                      {statusText}
                    </p>
                  </div>

                  {!isDisabled && (
                    <div
                        className={`
                                w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0
                                ${
                                isSelected
                                    ? "bg-gradient-to-br from-primary to-primary/80 border-primary shadow-glow"
                                    : "border-text-sub/30 hover:border-primary/50"
                                }
                            `}
                    >
                        {isSelected && (
                        <Icons.Check className="w-4 h-4 text-white" />
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-8 right-6 z-40 animate-slide-up"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            onClick={handleFabClick}
            className="h-14 px-6 bg-gradient-to-r from-primary to-primary/90 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center gap-2.5 font-bold tap-active hover:scale-105 transition-transform"
          >
            <Icons.Chat className="w-5 h-5" />
            <span className="text-sm">
              {selectedIds.size > 1 ? "Create Group" : "Start Chat"}
            </span>
          </button>
        </div>
      )}

      <BottomSheet
        isOpen={showNameModal}
        onClose={() => setShowNameModal(false)}
      >
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-bold text-text-main mb-2">
              Group name
            </h3>
            <p className="text-sm text-text-sub opacity-70">
              Give your group a unique name
            </p>
          </div>
          <Input
            autoFocus
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g., Project Team"
          />
          <button
            onClick={() => createConversation(groupName.trim() || "Group Chat")}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-primary to-primary/90 text-primary-fg shadow-lg shadow-primary/30 hover:shadow-primary/40 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Group"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default NewChat;
