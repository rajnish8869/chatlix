
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
    { id: 'midnight', name: 'Midnight', bg: '#0f172a' },
    { id: 'daylight', name: 'Daylight', bg: '#f8fafc' },
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
      
      <div className="p-5 space-y-6 max-w-lg mx-auto">
        
        {/* Profile Card */}
        <div className="bg-surface rounded-[32px] p-6 border border-white/5 shadow-soft flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary/20 to-transparent" />
            
            <div className="relative z-10 mb-4">
               <Avatar name={user?.username || '?'} size="xl" online={!isOffline} />
            </div>
            
            {isEditingName ? (
                <div className="flex gap-2 items-center w-full max-w-[240px] mb-2 z-10">
                    <Input 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        className="text-center h-10 py-2 text-lg font-bold bg-surface-highlight" 
                        autoFocus
                    />
                    <button onClick={saveName} className="p-2 bg-primary text-white rounded-full"><Icons.Check /></button>
                    <button onClick={() => setIsEditingName(false)} className="p-2 bg-surface-highlight text-text-sub rounded-full"><Icons.Close /></button>
                </div>
            ) : (
                <div className="flex items-center gap-2 mb-1 group relative z-10">
                    <h2 className="text-2xl font-bold tracking-tight">{user?.username}</h2>
                    <button onClick={startEdit} className="p-1.5 bg-surface-highlight rounded-full text-text-sub hover:text-primary transition-colors">
                        <Icons.Edit />
                    </button>
                </div>
            )}
            
            <p className="text-text-sub font-medium z-10">{user?.email}</p>
        </div>

        {/* Theme Switcher */}
        <div>
            <h3 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-4 ml-4">Appearance</h3>
            <div className="grid grid-cols-3 gap-3">
                {themes.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`
                            relative h-20 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 overflow-hidden
                            ${theme === t.id ? 'ring-2 ring-primary scale-105 shadow-glow' : 'opacity-70 grayscale'}
                        `}
                        style={{ backgroundColor: t.bg }}
                    >
                         <span className={`text-xs font-bold ${t.id === 'daylight' ? 'text-black' : 'text-white'}`}>{t.name}</span>
                        {theme === t.id && <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />}
                    </button>
                ))}
            </div>
        </div>

        {/* Configuration */}
        <div>
            <h3 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-4 ml-4">Preferences</h3>
            <div className="bg-surface rounded-[28px] overflow-hidden border border-white/5 shadow-soft">
                <div className="p-5 flex justify-between items-center cursor-pointer tap-active" onClick={toggleGroupChats}>
                    <span className="font-semibold text-text-main">Group Chats</span>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${areGroupsEnabled ? "bg-green-500" : "bg-surface-highlight"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${areGroupsEnabled ? "right-1" : "left-1"}`} />
                    </div>
                </div>
            </div>
        </div>

        <Button onClick={handleLogout} variant="danger" className="mt-4" disabled={loggingOut}>
            {loggingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
        
        <p className="text-center text-[10px] text-text-sub opacity-50 pt-4">Chatlix v3.0 (Material Revamp)</p>
      </div>
    </div>
  );
};

export default Settings;