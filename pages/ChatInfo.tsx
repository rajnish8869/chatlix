
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
      unblockUser,
      setChatWallpaper
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

  // Wallpaper state
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [wallpaperUploading, setWallpaperUploading] = useState(false);

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

  if (!currentChat || !user)
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-surface rounded-full mx-auto flex items-center justify-center">
            <Icons.Chat className="w-8 h-8 text-text-sub opacity-50" />
          </div>
          <p className="text-text-sub font-medium">Chat not found</p>
          <button onClick={() => navigate('/')} className="text-primary font-bold">Go Back</button>
        </div>
      </div>
    );

  const isAdmin = currentChat.type === 'group' && currentChat.admins?.includes(user.user_id);
  const isGroup = currentChat.type === 'group';

  // Get participants details
  const participants = currentChat.participants.map((id) => {
      if (id === user.user_id) return user;
      return contacts.find((u) => u.user_id === id) || { 
          user_id: id, 
          username: "Unknown User", 
          email: "", 
          status: "offline", 
          last_seen: "", 
          is_blocked: false 
      } as User;
  });

  // For private chats, get the other user
  const otherUser = !isGroup ? participants.find(p => p.user_id !== user.user_id) : null;
  const isBlocked = otherUser && user.blocked_users?.includes(otherUser.user_id);

  // --- Handlers ---

  const handleUpdateGroupInfo = async () => {
      if (!chatId || !editName.trim()) return;
      await updateGroupInfo(chatId, editName);
      setIsEditing(false);
  };

  const handleGroupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && chatId) {
          setIsUploading(true);
          try {
              await updateGroupInfo(chatId, undefined, e.target.files[0]);
          } catch(e) {
              console.error(e);
          }
          setIsUploading(false);
      }
  };

  const handleAddMember = async (userId: string) => {
      if (!chatId) return;
      setLoadingAction(true);
      try {
          await addGroupMember(chatId, userId);
          setShowAddModal(false);
      } catch (e) {
          alert("Failed to add member");
      }
      setLoadingAction(false);
  };

  const handleRemoveMember = (userId: string) => {
      setConfirmModal({
          isOpen: true,
          title: "Remove Member",
          message: "Are you sure you want to remove this person?",
          confirmText: "Remove",
          isDestructive: true,
          action: async () => {
              if (chatId) await removeGroupMember(chatId, userId);
          }
      });
  };

  const handleLeaveGroup = () => {
      setConfirmModal({
          isOpen: true,
          title: "Leave Group",
          message: "You will no longer receive messages from this group.",
          confirmText: "Leave",
          isDestructive: true,
          action: async () => {
              if (chatId) {
                  await removeGroupMember(chatId, user.user_id);
                  navigate('/');
              }
          }
      });
  };

  const handleDeleteChat = () => {
       setConfirmModal({
          isOpen: true,
          title: "Delete Chat",
          message: "This will permanently delete this conversation for you.",
          confirmText: "Delete",
          isDestructive: true,
          action: async () => {
              if (chatId) {
                  await deleteChats([chatId]);
                  navigate('/');
              }
          }
      });
  };

  const handleBlockToggle = () => {
      if (!otherUser) return;
      if (isBlocked) {
          unblockUser(otherUser.user_id);
      } else {
           setConfirmModal({
              isOpen: true,
              title: `Block ${otherUser.username}?`,
              message: "They won't be able to message you or see your status.",
              confirmText: "Block",
              isDestructive: true,
              action: async () => {
                  await blockUser(otherUser.user_id);
              }
          });
      }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && chatId) {
          setWallpaperUploading(true);
          try {
              await setChatWallpaper(chatId, e.target.files[0], false, false);
              setShowWallpaperModal(false);
          } catch(e) {
              console.error(e);
          }
          setWallpaperUploading(false);
      }
  };

  const handleColorWallpaper = async (color: string) => {
       if (chatId) {
           await setChatWallpaper(chatId, color, false, false);
           setShowWallpaperModal(false);
       }
  };

  const handleResetWallpaper = async () => {
       if (chatId) {
           await setChatWallpaper(chatId, null, false, false);
           setShowWallpaperModal(false);
       }
  };

  // Filter contacts for adding to group (exclude existing members)
  const availableContacts = contacts.filter(
      c => !currentChat.participants.includes(c.user_id) && 
      c.username.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex-1 bg-background text-text-main h-full overflow-y-auto pb-safe">
      <TopBar 
        title="Info" 
        onBack={() => navigate(-1)} 
        className="border-b border-white/5"
      />
      
      <div className="p-6 flex flex-col items-center">
         {/* Avatar & Name */}
         <div className="relative group mb-4">
             <Avatar 
                name={isGroup ? currentChat.name || "Group" : otherUser?.username || "Chat"} 
                src={isGroup ? currentChat.group_image : otherUser?.profile_picture}
                size="xl"
                className="shadow-2xl"
             />
             {isGroup && isAdmin && (
                 <>
                    <button 
                        className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Icons.Camera className="w-5 h-5" />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleGroupImageUpload} 
                        hidden 
                        accept="image/*" 
                    />
                 </>
             )}
         </div>

         {isEditing ? (
             <div className="flex gap-2 items-center mb-6">
                 <Input 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    className="text-center"
                    autoFocus
                 />
                 <button onClick={handleUpdateGroupInfo} className="p-2 bg-primary rounded-full text-white">
                     <Icons.Check className="w-5 h-5" />
                 </button>
             </div>
         ) : (
             <div className="flex items-center gap-2 mb-6">
                 <h1 className="text-2xl font-bold">{isGroup ? currentChat.name : otherUser?.username}</h1>
                 {isGroup && isAdmin && (
                     <button 
                        onClick={() => {
                            setEditName(currentChat.name || "");
                            setIsEditing(true);
                        }}
                        className="text-primary p-1"
                     >
                         <Icons.Edit className="w-5 h-5" />
                     </button>
                 )}
             </div>
         )}
         
         {/* Private Chat: Email/Bio placeholder */}
         {!isGroup && otherUser && (
             <p className="text-text-sub opacity-70 mb-6">{otherUser.email}</p>
         )}

         {/* Actions Grid */}
         <div className="w-full grid grid-cols-3 gap-3 mb-8">
             <button 
                onClick={() => setShowWallpaperModal(true)}
                className="flex flex-col items-center gap-2 p-4 bg-surface rounded-2xl border border-white/5 active:scale-95 transition-all"
             >
                 <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-full">
                     <Icons.Edit className="w-6 h-6" />
                 </div>
                 <span className="text-xs font-bold opacity-80">Wallpaper</span>
             </button>
             
             <button 
                onClick={() => setSearchFilter(prev => prev + " ")} // Dummy action or Media view
                className="flex flex-col items-center gap-2 p-4 bg-surface rounded-2xl border border-white/5 active:scale-95 transition-all"
             >
                 <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full">
                     <Icons.Camera className="w-6 h-6" />
                 </div>
                 <span className="text-xs font-bold opacity-80">Media</span>
             </button>

             <button 
                onClick={() => {/* Search functionality */}}
                className="flex flex-col items-center gap-2 p-4 bg-surface rounded-2xl border border-white/5 active:scale-95 transition-all"
             >
                 <div className="p-2 bg-blue-500/20 text-blue-400 rounded-full">
                     <Icons.Search className="w-6 h-6" />
                 </div>
                 <span className="text-xs font-bold opacity-80">Search</span>
             </button>
         </div>

         {/* Participants (Group Only) */}
         {isGroup && (
             <div className="w-full bg-surface/50 rounded-3xl p-5 mb-8 border border-white/5">
                 <div className="flex items-center justify-between mb-4">
                     <h3 className="text-sm font-bold text-text-sub uppercase tracking-wider">
                         {participants.length} Members
                     </h3>
                     {isAdmin && (
                         <button 
                            onClick={() => setShowAddModal(true)}
                            className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
                         >
                             <Icons.Plus className="w-4 h-4" />
                         </button>
                     )}
                 </div>
                 
                 <div className="space-y-4">
                     {participants.map(p => {
                         const isMe = p.user_id === user.user_id;
                         const isMemberAdmin = currentChat.admins?.includes(p.user_id);

                         return (
                             <div key={p.user_id} className="flex items-center gap-3">
                                 <Avatar name={p.username} src={p.profile_picture} size="sm" online={!isMe && p.status === 'online'} />
                                 <div className="flex-1 min-w-0">
                                     <h4 className={`font-bold text-sm ${isMe ? 'text-primary' : 'text-text-main'}`}>
                                         {isMe ? 'You' : p.username}
                                     </h4>
                                     <span className="text-xs text-text-sub opacity-60">
                                         {isMemberAdmin ? 'Admin' : (p.status === 'online' ? 'Online' : 'Offline')}
                                     </span>
                                 </div>
                                 {isAdmin && !isMe && (
                                     <button 
                                        onClick={() => handleRemoveMember(p.user_id)}
                                        className="p-2 text-danger opacity-50 hover:opacity-100"
                                     >
                                         <Icons.Close className="w-5 h-5" />
                                     </button>
                                 )}
                             </div>
                         );
                     })}
                 </div>
             </div>
         )}

         {/* Danger Zone */}
         <div className="w-full bg-surface/50 rounded-3xl overflow-hidden border border-white/5">
             {!isGroup && (
                 <button 
                    onClick={handleBlockToggle}
                    className="w-full p-4 flex items-center gap-3 hover:bg-surface-highlight text-text-main font-semibold border-b border-white/5"
                 >
                     <Icons.Lock className={`w-5 h-5 ${isBlocked ? 'text-primary' : 'text-danger'}`} />
                     <span className={isBlocked ? 'text-primary' : 'text-danger'}>
                         {isBlocked ? 'Unblock User' : 'Block User'}
                     </span>
                 </button>
             )}
             
             {isGroup && (
                 <button 
                    onClick={handleLeaveGroup}
                    className="w-full p-4 flex items-center gap-3 hover:bg-surface-highlight text-danger font-semibold border-b border-white/5"
                 >
                     <Icons.Close className="w-5 h-5" />
                     <span>Leave Group</span>
                 </button>
             )}

             <button 
                onClick={handleDeleteChat}
                className="w-full p-4 flex items-center gap-3 hover:bg-surface-highlight text-danger font-semibold"
             >
                 <Icons.Trash className="w-5 h-5" />
                 <span>Delete Conversation</span>
             </button>
         </div>
      </div>

      {/* Add Member Modal */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <div className="h-[60vh] flex flex-col">
              <h3 className="text-lg font-bold mb-4">Add Participants</h3>
              <Input 
                  placeholder="Search contacts..." 
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="mb-4"
              />
              <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                  {availableContacts.length === 0 ? (
                      <p className="text-center text-text-sub opacity-60 mt-10">No contacts available</p>
                  ) : (
                      availableContacts.map(c => (
                          <div key={c.user_id} className="flex items-center justify-between p-3 bg-surface/50 rounded-2xl">
                              <div className="flex items-center gap-3">
                                  <Avatar name={c.username} src={c.profile_picture} size="sm" />
                                  <span className="font-bold text-sm">{c.username}</span>
                              </div>
                              <button 
                                disabled={loadingAction}
                                onClick={() => handleAddMember(c.user_id)}
                                className="px-4 py-2 bg-primary/20 text-primary rounded-xl font-bold text-xs"
                              >
                                  Add
                              </button>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </BottomSheet>

      {/* Wallpaper Modal */}
      <BottomSheet isOpen={showWallpaperModal} onClose={() => setShowWallpaperModal(false)}>
          <div className="pb-4">
              <h3 className="text-lg font-bold mb-4">Set Wallpaper</h3>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                  {['#0b101a', '#1a1a1a', '#2d3748', '#4a5568', '#718096', '#742a2a', '#276749', '#2c5282'].map(color => (
                      <button 
                        key={color}
                        onClick={() => handleColorWallpaper(color)}
                        className="w-full aspect-square rounded-xl border border-white/10 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                  ))}
              </div>

              <div className="flex flex-col gap-3">
                  <button 
                     onClick={() => wallpaperInputRef.current?.click()}
                     className="w-full py-3 bg-surface-highlight rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  >
                      <Icons.Camera className="w-5 h-5" />
                      Upload Image
                  </button>
                  <input 
                     type="file" 
                     ref={wallpaperInputRef} 
                     onChange={handleWallpaperUpload} 
                     hidden 
                     accept="image/*"
                  />
                  
                  <button 
                     onClick={handleResetWallpaper}
                     className="w-full py-3 bg-danger/10 text-danger rounded-xl font-bold text-sm"
                  >
                      Reset to Default
                  </button>
              </div>
              
              {wallpaperUploading && (
                  <div className="text-center mt-4 text-xs text-text-sub animate-pulse">
                      Uploading...
                  </div>
              )}
          </div>
      </BottomSheet>

      {/* Confirmation Modal */}
      <ConfirmationModal
         isOpen={confirmModal.isOpen}
         onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
         onConfirm={() => {
             confirmModal.action();
             setConfirmModal(prev => ({ ...prev, isOpen: false }));
         }}
         title={confirmModal.title}
         message={confirmModal.message}
         confirmText={confirmModal.confirmText}
         isDestructive={confirmModal.isDestructive}
      />
    </div>
  );
};

export default ChatInfo;
