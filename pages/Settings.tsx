
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { TopBar, Button, Icons, Input, Avatar } from '../components/AndroidUI';

const Settings: React.FC = () => {
  const { user, logout, updateName, toggleGroupChats } = useAuth();
  const { isOffline } = useData();
  const { theme, setTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const themes: { id: Theme; name: string; bg: string }[] = [
    { id: 'midnight', name: 'Midnight', bg: '#0b101a' },
    { id: 'daylight', name: 'Daylight', bg: '#f0f4f8' },
    { id: 'eclipse', name: 'Eclipse', bg: '#000000' },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const startEdit = () => {
      setEditName(user?.username || '');
      setIsEditingName(true);
  };

  const saveName = async () => {
      if(!editName.trim()) return;
      await updateName(editName.trim());
      setIsEditingName(false);
  };

  const areGroupsEnabled = user?.enable_groups ?? true;

  return (
    <div 
      className="flex-1 bg-background text-text-main pb-24 overflow-y-auto"
      style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
    >
      <TopBar title="Settings" transparent />
      
      <div className="p-5 space-y-8 max-w-lg mx-auto">
        
        {/* Profile Card */}
        <div className="bg-surface rounded-[40px] p-8 border border-white/5 shadow-soft flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50" />
            
            <div className="relative z-10 mb-5 scale-110">
               <Avatar name={user?.username || '?'} size="xl" online={!isOffline} />
            </div>
            
            {isEditingName ? (
                <div className="flex gap-2 items-center w-full max-w-[240px] mb-2 z-10 animate-fade-in">
                    <Input 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        className="text-center h-12 py-2 text-lg font-bold bg-surface-highlight border-primary/50" 
                        autoFocus
                    />
                    <button onClick={saveName} className="p-3 bg-primary text-white rounded-xl shadow-lg hover:scale-105 transition-transform"><Icons.Check /></button>
                    <button onClick={() => setIsEditingName(false)} className="p-3 bg-surface-highlight text-text-sub rounded-xl hover:bg-surface-highlight/80"><Icons.Close /></button>
                </div>
            ) : (
                <div className="flex items-center gap-3 mb-1 relative z-10">
                    <h2 className="text-3xl font-black tracking-tight">{user?.username}</h2>
                    <button onClick={startEdit} className="p-2 bg-surface-highlight/50 rounded-full text-text-sub hover:text-primary hover:bg-surface-highlight transition-all">
                        <Icons.Edit />
                    </button>
                </div>
            )}
            
            <p className="text-text-sub font-medium z-10 opacity-70">{user?.email}</p>
        </div>

        {/* Theme Switcher */}
        <div>
            <h3 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-4 ml-4 opacity-70">Appearance</h3>
            <div className="grid grid-cols-3 gap-4">
                {themes.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`
                            relative h-24 rounded-[24px] transition-all flex flex-col items-center justify-center gap-3 overflow-hidden border
                            ${theme === t.id ? 'ring-2 ring-primary border-primary scale-105 shadow-glow' : 'border-white/5 opacity-70 grayscale hover:grayscale-0 hover:opacity-100'}
                        `}
                        style={{ backgroundColor: t.bg }}
                    >
                         <span className={`text-sm font-bold ${t.id === 'daylight' ? 'text-black' : 'text-white'}`}>{t.name}</span>
                        {theme === t.id && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-primary rounded-full shadow-glow" />}
                    </button>
                ))}
            </div>
        </div>

        {/* Preferences */}
        <div>
            <h3 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-4 ml-4 opacity-70">Preferences</h3>
            <div className="bg-surface rounded-[32px] overflow-hidden border border-white/5 shadow-soft">
                <div className="p-6 flex justify-between items-center cursor-pointer tap-active hover:bg-surface-highlight/30 transition-colors" onClick={toggleGroupChats}>
                    <div className="flex flex-col gap-1">
                        <span className="font-bold text-lg text-text-main">Group Chats</span>
                        <span className="text-xs text-text-sub">Allow creating and being added to groups</span>
                    </div>
                    <div className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${areGroupsEnabled ? "bg-emerald-500 shadow-glow" : "bg-surface-highlight border border-white/10"}`}>
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-300 ${areGroupsEnabled ? "translate-x-7" : "translate-x-1"}`} />
                    </div>
                </div>
            </div>
        </div>

        <Button onClick={handleLogout} variant="danger" className="mt-8 py-5 text-lg" disabled={loggingOut}>
            {loggingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
        
        <p className="text-center text-[10px] text-text-sub opacity-30 pt-6 font-mono">Chatlix v3.1 • Build 2024.10</p>
      </div>
    </div>
  );
};

export default Settings;
