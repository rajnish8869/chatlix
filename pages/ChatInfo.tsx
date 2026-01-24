

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { TopBar, Icons, Avatar, ConfirmationModal, BottomSheet, Input } from "../components/AndroidUI";
import { User } from "../types";

const ChatInfo: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { 
      chats, 
      contacts, 
      loadContacts, 
      updateGroupInfo, 
      addGroupMember, 
      removeGroupMember,
      deleteChats, 
      blockUser,
      unblockUser
  } = useData();
  const { user } = useAuth();
  
  const currentChat = chats.find((c) => c.chat_id === chatId);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      action: () => Promise<void>;
      isDestructive: boolean;
      confirmText: string;
  }>({ isOpen: false, title: "", message: "", action: async () => {}, isDestructive: false, confirmText: "" });

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

  const isAdmin = currentChat.type === 'group' && currentChat.admins?.includes(user?.user_id || '');
  const isGroup = currentChat.type === 'group';

  const participants = currentChat.participants.map((id) => {
      const contact = contacts.find((u) => u.user_id === id);
      if (id === user?.user_id && user) {
          return { ...user, isMe: true };
      }
      if (contact) {
          return { ...contact, isMe: false };
      }
      
      const unknownUser: User & { isMe: boolean } = {
          user_id: id,
          username: "Unknown User",
          email: "",
          status: "offline",
          last_seen: "",
          is_blocked: false,
          isMe: false,
          profile_picture: undefined
      };
      return unknownUser;
    });

  const otherPerson = !isGroup ? participants.find(p => !p.isMe) : null;
  const isOtherBlocked = otherPerson && user?.blocked_users?.includes(otherPerson.user_id);

  const availableContacts = contacts.filter(
      c => !currentChat.participants.includes(c.user_id) && 
      c.username.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleEditSave = async () => {
      if (!editName.trim()) return;
      setLoadingAction(true);
      try {
          await updateGroupInfo(chatId!, editName);
          setIsEditing(false);
      } catch (e) {
          console.error(e);
      }
      setLoadingAction(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          try {
             await updateGroupInfo(chatId!, undefined, e.target.files[0]);
          } catch (error) {
              console.error("Failed to upload group image");
          } finally {
              setIsUploading(false);
              if(fileInputRef.current) fileInputRef.current.value = "";
          }
      }
  };

  const handleAddMember = async (userId: string) => {
      setLoadingAction(true);
      try {
          await addGroupMember(chatId!, userId);
          setShowAddModal(false);
      } catch (e) {
          alert("Failed to add member");
      }
      setLoadingAction(false);
  };

  const promptRemoveMember = (member: any) => {
      setConfirmModal({
          isOpen: true,
          title: "Remove Member?",
          message: `Are you sure you want to remove ${member.username} from the group?`,
          isDestructive: true,
          confirmText: "Remove",
          action: async () => {
              await removeGroupMember(chatId!, member.user_id);
          }
      });
  };

  const promptLeaveGroup = () => {
      setConfirmModal({
          isOpen: true,
          title: "Leave Group?",
          message: "You will no longer receive messages from this group.",
          isDestructive: true,
          confirmText: "Leave",
          action: async () => {
              if (participants.length === 1) {
                   await deleteChats([chatId!]); 
              } else {
                   await removeGroupMember(chatId!, user!.user_id);
              }
              navigate('/');
          }
      });
  };

  const promptBlockUser = () => {
      if (!otherPerson) return;
      
      if (isOtherBlocked) {
          setConfirmModal({
              isOpen: true,
              title: "Unblock User?",
              message: `You will be able to receive messages from ${otherPerson.username} again.`,
              isDestructive: false,
              confirmText: "Unblock",
              action: async () => {
                  await unblockUser(otherPerson.user_id);
              }
          });
      } else {
          setConfirmModal({
              isOpen: true,
              title: "Block User?",
              message: `You will no longer receive messages from ${otherPerson.username}.`,
              isDestructive: true,
              confirmText: "Block",
              action: async () => {
                  await blockUser(otherPerson.user_id);
              }
          });
      }
  };

  return (
    <div className="flex-1 bg-background text-text-main h-full flex flex-col overflow-hidden">
      <TopBar
        title="Chat Info"
        onBack={() => navigate(-1)}
        className="border-b border-white/5"
      />

      <div className="flex-1 overflow-y-auto pb-10 min-h-0">
        <div className="flex flex-col items-center pt-8 pb-10 px-6 relative">
          <div className="relative mb-6 group">
             <div 
                className={`relative transform transition-transform duration-500 ${isGroup && isAdmin ? 'cursor-pointer hover:scale-105' : ''}`}
                onClick={() => isGroup && isAdmin && fileInputRef.current?.click()}
             >
                <Avatar
                    name={currentChat.name || "C"}
                    src={currentChat.group_image || (currentChat.type === 'private' ? participants.find(p => !p.isMe)?.profile_picture : undefined)}
                    size="xl"
                    className="shadow-2xl shadow-primary/30"
                    showStatus={false}
                />
                {isGroup && isAdmin && (
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         {isUploading ? (
                             <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                         ) : (
                             <Icons.Camera className="w-8 h-8 text-white" />
                         )}
                    </div>
                )}
             </div>
             <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
          </div>

          {isEditing ? (
              <div className="flex items-center gap-2 mb-2 w-full max-w-xs animate-fade-in">
                  <Input 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      className="text-center font-bold text-lg py-2" 
                      autoFocus
                  />
                  <button onClick={handleEditSave} disabled={loadingAction} className="p-2 bg-primary rounded-full text-white">
                      <Icons.Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsEditing(false)} className="p-2 bg-surface-highlight rounded-full text-text-sub">
                      <Icons.Close className="w-5 h-5" />
                  </button>
              </div>
          ) : (
            <div className="flex items-center gap-2 mb-2">
                <h2 className="text-3xl font-black tracking-tight text-center">
                    {currentChat.name || "Conversation"}
                </h2>
                {isGroup && isAdmin && (
                    <button onClick={() => { setEditName(currentChat.name || ""); setIsEditing(true); }} className="text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors">
                        <Icons.Edit className="w-5 h-5" />
                    </button>
                )}
            </div>
          )}
          
          <span className="px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full text-xs font-bold text-primary tracking-wide uppercase">
            {currentChat.type === "group" ? "Group" : "Private Chat"}
          </span>
        </div>

        <div className="px-5 max-w-2xl mx-auto space-y-6">
          
          {/* Members Section */}
          <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest opacity-70">
                    Members ({participants.length})
                </h3>
                {isGroup && isAdmin && (
                    <button 
                        onClick={() => { setSearchFilter(""); setShowAddModal(true); }}
                        className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors"
                    >
                        <Icons.Plus className="w-4 h-4" />
                        <span>Add Member</span>
                    </button>
                )}
              </div>
              
              <div className="bg-surface rounded-[28px] border border-white/10 overflow-hidden shadow-md">
                {participants.map((p, idx) => (
                <div
                    key={p.user_id}
                    className={`flex items-center gap-3.5 p-5 ${idx !== participants.length - 1 ? "border-b border-white/5" : ""} hover:bg-surface-highlight/20 transition-colors group`}
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
                        {currentChat.admins?.includes(p.user_id) && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                ADMIN
                            </span>
                        )}
                        {!isGroup && user?.blocked_users?.includes(p.user_id) && (
                            <span className="text-[10px] bg-danger/20 text-danger px-2.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                BLOCKED
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-text-sub opacity-70 truncate">
                        {p.status}
                    </p>
                    </div>
                    
                    {isGroup && isAdmin && !p.isMe && (
                        <button 
                            onClick={() => promptRemoveMember(p)}
                            className="p-2 text-danger hover:bg-danger/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Icons.Trash className="w-5 h-5" />
                        </button>
                    )}
                </div>
                ))}
              </div>
          </div>

          <div className="pt-4 space-y-3">
              {isGroup ? (
                  <button 
                      onClick={promptLeaveGroup}
                      className="w-full py-4 rounded-2xl font-bold bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors flex items-center justify-center gap-2"
                  >
                      <Icons.Trash className="w-5 h-5" />
                      Leave Group
                  </button>
              ) : (
                  otherPerson && (
                      <button 
                          onClick={promptBlockUser}
                          className={`
                              w-full py-4 rounded-2xl font-bold border transition-colors flex items-center justify-center gap-2
                              ${isOtherBlocked 
                                  ? "bg-surface text-text-main border-white/10 hover:bg-surface-highlight" 
                                  : "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20"}
                          `}
                      >
                          <span className="text-xl">{isOtherBlocked ? "🔓" : "🚫"}</span>
                          {isOtherBlocked ? "Unblock User" : "Block User"}
                      </button>
                  )
              )}
          </div>

        </div>
      </div>

      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <div className="flex flex-col gap-4 max-h-[60vh]">
              <h3 className="text-lg font-bold">Add Members</h3>
              <Input 
                  placeholder="Search contacts..." 
                  value={searchFilter} 
                  onChange={e => setSearchFilter(e.target.value)} 
              />
              <div className="overflow-y-auto space-y-2 mt-2">
                  {availableContacts.length === 0 ? (
                      <p className="text-center text-text-sub opacity-60 py-4">No contacts found to add.</p>
                  ) : (
                      availableContacts.map(c => (
                          <button 
                              key={c.user_id}
                              onClick={() => handleAddMember(c.user_id)}
                              disabled={loadingAction}
                              className="w-full flex items-center gap-3 p-3 hover:bg-surface-highlight rounded-xl transition-colors text-left"
                          >
                              <Avatar name={c.username} src={c.profile_picture} size="md" />
                              <div className="flex-1">
                                  <h4 className="font-bold">{c.username}</h4>
                              </div>
                              <div className="p-2 bg-primary/10 rounded-full text-primary">
                                  <Icons.Plus className="w-5 h-5" />
                              </div>
                          </button>
                      ))
                  )}
              </div>
          </div>
      </BottomSheet>

      <ConfirmationModal 
          isOpen={confirmModal.isOpen} 
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.action}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          isDestructive={confirmModal.isDestructive}
      />
    </div>
  );
};

export default ChatInfo;
