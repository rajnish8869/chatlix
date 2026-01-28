import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useChatStore } from "../store/chatStore";
import { useTheme, Theme } from "../context/ThemeContext";
import { useSecurity } from "../context/SecurityContext";
import { TopBar, Button, Icons, Input, Avatar, AlertModal } from "../components/AndroidUI";
import { notificationService } from "../services/notificationService";

const Settings: React.FC = () => {
  const { user, logout, updateName, toggleGroupChats, updateProfilePicture } = useAuth();
  const isOffline = useChatStore(state => state.isOffline);
  const { theme, setTheme } = useTheme();
  const { isSupported, isBiometricEnabled, toggleBiometric } = useSecurity();
  const [loggingOut, setLoggingOut] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const [showTestAlert, setShowTestAlert] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const themes: { id: Theme; name: string; bg: string }[] = [
    { id: "midnight", name: "Midnight", bg: "#0b101a" },
    { id: "daylight", name: "Daylight", bg: "#f0f4f8" },
    { id: "eclipse", name: "Eclipse", bg: "#000000" },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const startEdit = () => {
    setEditName(user?.username || "");
    setIsEditingName(true);
  };

  const saveName = async () => {
    if (!editName.trim()) return;
    await updateName(editName.trim());
    setIsEditingName(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          try {
             await updateProfilePicture(e.target.files[0]);
          } catch (error) {
              console.error("Failed to upload profile picture");
          } finally {
              setIsUploading(false);
              // Reset input
              if(fileInputRef.current) fileInputRef.current.value = "";
          }
      }
  };

  const handleTestNotification = async () => {
      if (!user) return;
      setShowTestAlert(true);
      
      setTimeout(async () => {
          await notificationService.triggerNotification(
              user.user_id,
              "test_chat",
              user.username, // Sender Name
              false
          );
      }, 5000);
  };

  const areGroupsEnabled = user?.enable_groups ?? true;

  return (
    <div
      className="flex-1 bg-background text-text-main h-full overflow-y-auto pb-24"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}
    >
      <TopBar title="Settings" className="border-b border-white/5" />

      <div className="p-5 space-y-6 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-surface/80 to-surface/40 rounded-[32px] p-8 border border-white/10 shadow-lg flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50" />

          <div 
             className="relative z-10 mb-5 group cursor-pointer"
             onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <Avatar
              name={user?.username || "?"}
              src={user?.profile_picture}
              size="xl"
              online={!isOffline}
            />
            {/* Overlay for upload */}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                {isUploading ? (
                     <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Icons.Camera className="w-8 h-8 text-white" />
                )}
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                hidden 
                accept="image/*"
            />
          </div>

          {isEditingName ? (
            <div className="flex gap-2 items-center w-full max-w-[250px] mb-3 z-10 animate-fade-in">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-center py-3 text-lg font-bold bg-surface/60 border-primary/40"
                autoFocus
              />
              <button
                onClick={saveName}
                className="p-3 bg-primary text-white rounded-full shadow-lg hover:scale-105 transition-transform flex-shrink-0"
              >
                <Icons.Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="p-3 bg-surface text-text-sub rounded-full hover:bg-surface-highlight transition-colors flex-shrink-0"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 mb-1.5 relative z-10">
              <h2 className="text-3xl font-black tracking-tight">
                {user?.username}
              </h2>
              <button
                onClick={startEdit}
                className="p-2 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-all"
              >
                <Icons.Edit className="w-5 h-5" />
              </button>
            </div>
          )}

          <p className="text-text-sub font-medium z-10 opacity-70 text-sm">
            {user?.email}
          </p>
          <span
            className={`mt-3 text-xs font-bold px-3 py-1 rounded-full ${isOffline ? "bg-danger/20 text-danger" : "bg-emerald-500/20 text-emerald-500"}`}
          >
            {isOffline ? "Offline" : "Online"}
          </span>
        </div>

        <div>
          <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest mb-4 ml-1 opacity-70">
            Appearance
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`
                            relative h-24 rounded-[24px] transition-all flex flex-col items-center justify-center gap-2 overflow-hidden border shadow-md
                            ${theme === t.id ? "ring-2 ring-primary border-primary scale-105 shadow-lg shadow-primary/30" : "border-white/10 opacity-70 grayscale hover:grayscale-0 hover:opacity-100"}
                        `}
                style={{ backgroundColor: t.bg }}
              >
                <span
                  className={`text-xs font-bold ${t.id === "daylight" ? "text-black" : "text-white"}`}
                >
                  {t.name}
                </span>
                {theme === t.id && (
                  <div className="w-2 h-2 bg-current rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {isSupported && (
            <div>
                <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest mb-4 ml-1 opacity-70">
                    Privacy & Security
                </h3>
                <div className="bg-surface rounded-[28px] overflow-hidden border border-white/10 shadow-md">
                    <div
                        className="p-5 flex justify-between items-center cursor-pointer hover:bg-surface-highlight/30 transition-colors"
                        onClick={toggleBiometric}
                    >
                        <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-lg text-text-main flex items-center gap-2">
                                <Icons.Fingerprint className="w-5 h-5 text-primary" />
                                Biometric Lock
                            </span>
                            <span className="text-xs text-text-sub opacity-70">
                                Require Fingerprint/FaceID to unlock app
                            </span>
                        </div>
                        <div
                            className={`w-14 h-8 rounded-full relative transition-colors duration-300 flex-shrink-0 ${isBiometricEnabled ? "bg-primary shadow-lg shadow-primary/40" : "bg-surface-highlight border border-white/20"}`}
                        >
                            <div
                                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${isBiometricEnabled ? "translate-x-7" : "translate-x-1"}`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div>
          <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest mb-4 ml-1 opacity-70">
            Preferences
          </h3>
          <div className="bg-surface rounded-[28px] overflow-hidden border border-white/10 shadow-md">
            <div
              className="p-5 flex justify-between items-center cursor-pointer hover:bg-surface-highlight/30 transition-colors"
              onClick={toggleGroupChats}
            >
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-lg text-text-main">
                  Group Chats
                </span>
                <span className="text-xs text-text-sub opacity-70">
                  Create and join group conversations
                </span>
              </div>
              <div
                className={`w-14 h-8 rounded-full relative transition-colors duration-300 flex-shrink-0 ${areGroupsEnabled ? "bg-emerald-500 shadow-lg shadow-emerald-500/40" : "bg-surface-highlight border border-white/20"}`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${areGroupsEnabled ? "translate-x-7" : "translate-x-1"}`}
                />
              </div>
            </div>
            
            {/* DEBUG BUTTON */}
            <div 
              onClick={handleTestNotification}
              className="p-5 flex justify-between items-center cursor-pointer hover:bg-surface-highlight/30 transition-colors border-t border-white/5"
            >
                <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-lg text-text-main">
                        Test Notification
                    </span>
                    <span className="text-xs text-text-sub opacity-70">
                        Simulate an incoming message (5s delay)
                    </span>
                </div>
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                    <Icons.Send className="w-5 h-5" />
                </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-danger to-danger/80 text-white shadow-lg shadow-danger/30 hover:shadow-danger/40 disabled:opacity-50 transition-all mt-4"
        >
          {loggingOut ? "Signing Out..." : "Sign Out"}
        </button>

        <p className="text-center text-[10px] text-text-sub opacity-30 pt-6 font-mono">
          Chatlix v3.3 • Build 2024.12
        </p>

        <AlertModal 
            isOpen={showTestAlert} 
            onClose={() => setShowTestAlert(false)} 
            title="Testing Notifications" 
            message="Sending test notification in 5 seconds... Please close the app or lock your screen now." 
        />
      </div>
    </div>
  );
};

export default Settings;