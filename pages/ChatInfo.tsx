



import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { TopBar, Icons, Avatar, ConfirmationModal, BottomSheet, Input } from "../components/AndroidUI";
import { User, Wallpaper } from "../types";

const GRADIENTS = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)",
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
    "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    "linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)",
    "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
];

const COLORS = [
    "#000000", "#1a1a1a", "#2d3748", "#4a5568", 
    "#718096", "#e53e3e", "#dd6b20", "#38a169", 
    "#3182ce", "#805ad5", "#d53f8c", "#ffffff"
];

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
      unblockUser,
      setWallpaper,
      uploadWallpaper
  } = useData();
  const { user } = useAuth();
  
  const currentChat = chats.find((c) => c.chat_id === chatId);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Wallpaper State
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

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
  const iBlockedThem = otherPerson && user?.blocked_users?.includes(otherPerson.user_id);
  const theyBlockedMe = otherPerson?.blocked_users?.includes(user?.user_id || '');
  
  const displayProfilePic = theyBlockedMe ? undefined : (currentChat.group_image || (currentChat.type === 'private' ? otherPerson?.profile_picture : undefined));
  const displayName = currentChat.name || "Conversation";

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
      
      if (iBlockedThem) {
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

  // --- WALLPAPER HANDLERS ---
  const applyWallpaper = async (wallpaper: Wallpaper | null) => {
      setLoadingAction(true);
      const isShared = isGroup && isAdmin; // If group and admin, share it. Otherwise local.
      // NOTE: This logic could be refined (e.g., prompt user if they want to share or keep local)
      // For now: Groups share if admin, Privates are local.
      try {
          await setWallpaper(chatId!, wallpaper, isShared);
          setShowWallpaperModal(false);
      } catch (e) {
          console.error(e);
      }
      setLoadingAction(false);
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setUploadingWallpaper(true);
          try {
              const url = await uploadWallpaper(e.target.files[0]);
              await applyWallpaper({ type: 'image', value: url, opacity: 0.7 });
          } catch (e) {
              console.error("Failed to upload wallpaper", e);
          }
          setUploadingWallpaper(false);
          if (wallpaperInputRef.current) wallpaperInputRef.current.value = "";
      }
  };

  return (
    <div className="flex-1 bg-background text-text-main h-full flex flex-col overflow-hidden">
      <TopBar
        title="Chat Info"
        onBack={() => navigate(-1)}
        className="border-b border-white/5"
      />

      <div className="flex-1 overflow-y-auto pb-[calc(2.5rem+env(safe-area-inset-bottom))] min-h-0">
        <div className="flex flex-col items-center pt-8 pb-10 px-6 relative">
          <div className="relative mb-6 group">
             <div 
                className={`relative transform transition-transform duration-500 ${isGroup && isAdmin ? 'cursor-pointer hover:scale-105' : ''}`}
                onClick={() => isGroup && isAdmin && fileInputRef.current?.click()}
             >
                <Avatar
                    name={currentChat.name || "C"}
                    src={displayProfilePic}
                    size="xl"
                    className="shadow-2xl shadow-primary/30"
                    showStatus={!isGroup && !theyBlockedMe}
                    online={(!isGroup && !theyBlockedMe && !iBlockedThem) ? (otherPerson?.status === 'online') : undefined}
                    blocked={iBlockedThem}
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
                    {displayName}
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
          
          {/* Wallpaper Section */}
          {(!isGroup || isAdmin) && (
            <button 
                onClick={() => setShowWallpaperModal(true)}
                className="w-full bg-surface rounded-[24px] p-5 flex items-center justify-between border border-white/10 hover:bg-surface-highlight/30 transition-colors shadow-sm"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-500/20 rounded-xl text-purple-400">
                        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-text-main">Chat Wallpaper</h3>
                        <p className="text-xs text-text-sub opacity-70">Customise chat background</p>
                    </div>
                </div>
                <Icons.ChevronDown className="w-5 h-5 text-text-sub -rotate-90" />
            </button>
          )}

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
                {participants.map((p, idx) => {
                  const isBlocked = user?.blocked_users?.includes(p.user_id);
                  const isOnline = p.status === 'online';
                  
                  return (
                    <div
                        key={p.user_id}
                        className={`flex items-center gap-3.5 p-5 ${idx !== participants.length - 1 ? "border-b border-white/5" : ""} hover:bg-surface-highlight/20 transition-colors group`}
                    >
                        <Avatar
                            name={p.username}
                            src={(!isGroup && theyBlockedMe) ? undefined : p.profile_picture}
                            size="md"
                            online={(!isGroup && theyBlockedMe) ? undefined : isOnline}
                            blocked={isBlocked}
                            showStatus={!theyBlockedMe}
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
                            {isBlocked && (
                                <span className="text-[10px] bg-danger/20 text-danger px-2.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                    BLOCKED
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-text-sub opacity-70 truncate">
                            {(!isGroup && theyBlockedMe) ? "" : p.status}
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
                  );
                })}
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
                              ${iBlockedThem 
                                  ? "bg-surface text-text-main border-white/10 hover:bg-surface-highlight" 
                                  : "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20"}
                          `}
                      >
                          <span className="text-xl">{iBlockedThem ? "🔓" : "🚫"}</span>
                          {iBlockedThem ? "Unblock User" : "Block User"}
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

      <BottomSheet isOpen={showWallpaperModal} onClose={() => setShowWallpaperModal(false)}>
        <div className="flex flex-col gap-5 max-h-[80vh]">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-main">Set Wallpaper</h3>
                <button 
                    onClick={() => applyWallpaper(null)}
                    className="text-xs font-bold text-text-sub opacity-60 hover:opacity-100 hover:text-danger uppercase tracking-wider"
                >
                    Reset to Default
                </button>
            </div>
            
            <div 
                className="w-full h-24 rounded-2xl bg-surface-highlight border-2 border-dashed border-white/10 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden"
                onClick={() => !uploadingWallpaper && wallpaperInputRef.current?.click()}
            >
                {uploadingWallpaper ? (
                    <div className="flex items-center gap-2 text-primary animate-pulse">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-bold">Uploading...</span>
                    </div>
                ) : (
                    <>
                        <Icons.Camera className="w-6 h-6 text-text-sub mb-1" />
                        <span className="text-xs font-bold text-text-sub">Upload Image</span>
                    </>
                )}
                <input type="file" ref={wallpaperInputRef} onChange={handleWallpaperUpload} accept="image/*" hidden />
            </div>

            <div>
                <h4 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-3">Gradients</h4>
                <div className="grid grid-cols-4 gap-3">
                    {GRADIENTS.map((g, i) => (
                        <button 
                            key={i}
                            onClick={() => applyWallpaper({ type: 'gradient', value: g, opacity: 0.8 })}
                            className="aspect-square rounded-xl shadow-sm hover:scale-105 transition-transform"
                            style={{ background: g }}
                        />
                    ))}
                </div>
            </div>

            <div>
                <h4 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-3">Solid Colors</h4>
                <div className="grid grid-cols-6 gap-3">
                    {COLORS.map((c, i) => (
                        <button 
                            key={i}
                            onClick={() => applyWallpaper({ type: 'color', value: c, opacity: 0.9 })}
                            className="aspect-square rounded-full shadow-sm hover:scale-110 transition-transform border border-white/10"
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            </div>
            
            {loadingAction && (
                <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center rounded-[40px] z-50">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
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