import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { TopBar, Button } from '../components/AndroidUI';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { settings, isOffline } = useData();
  const { theme, setTheme } = useTheme();

  const themes: { id: Theme; name: string; bg: string; border: string }[] = [
    { id: 'midnight', name: 'Midnight', bg: '#0f172a', border: 'border-slate-700' },
    { id: 'daylight', name: 'Daylight', bg: '#f3f4f6', border: 'border-gray-200' },
    { id: 'eclipse', name: 'Eclipse', bg: '#000000', border: 'border-zinc-800' },
  ];

  return (
    <div 
      className="flex-1 bg-background text-text-main pb-20 overflow-y-auto pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
    >
      <TopBar title="Settings" />
      
      <div className="p-5 space-y-6 max-w-lg mx-auto">
        
        {/* Profile Card */}
        <div className="bg-surface rounded-3xl p-6 border border-border shadow-sm flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-purple-500 p-0.5 mb-4 shadow-lg shadow-primary/20">
                <div className="w-full h-full bg-surface rounded-full flex items-center justify-center text-3xl font-bold text-text-main relative">
                    {user?.username[0].toUpperCase()}
                    <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-surface ${!isOffline ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{user?.username}</h2>
            <p className="text-text-sub font-medium">{user?.email}</p>
            <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${!isOffline ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {isOffline ? 'OFFLINE MODE' : 'CONNECTED'}
            </div>
        </div>

        {/* Theme Switcher */}
        <div>
            <h3 className="text-sm font-bold text-text-sub uppercase tracking-wider mb-3 ml-2">Theme</h3>
            <div className="grid grid-cols-3 gap-3">
                {themes.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`
                            relative h-24 rounded-2xl border-2 transition-all flex flex-col items-center justify-end pb-3 gap-2 overflow-hidden tap-active
                            ${theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
                        `}
                        style={{ backgroundColor: t.bg }}
                    >
                        {/* Preview bubbles */}
                        <div className="absolute top-2 left-2 right-2 flex flex-col gap-1.5 opacity-50 pointer-events-none">
                            <div className="h-2 w-2/3 bg-current rounded-full opacity-20 self-start"></div>
                            <div className="h-2 w-1/2 bg-current rounded-full opacity-40 self-end"></div>
                        </div>

                        <span className={`text-xs font-bold z-10 ${theme === t.id ? 'text-primary' : 'text-gray-400'}`}>{t.name}</span>
                        
                        {theme === t.id && (
                            <div className="absolute top-2 right-2 w-3 h-3 bg-primary rounded-full shadow-sm" />
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* Configuration */}
        <div>
            <h3 className="text-sm font-bold text-text-sub uppercase tracking-wider mb-3 ml-2">App Info</h3>
            <div className="bg-surface rounded-3xl overflow-hidden border border-border shadow-sm">
                <div className="p-4 flex justify-between items-center border-b border-border">
                    <span className="font-semibold text-text-main">Groups Enabled</span>
                    <div className={`w-8 h-4 rounded-full relative ${settings.enable_groups ? "bg-green-500/20" : "bg-red-500/20"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${settings.enable_groups ? "right-0.5 bg-green-500" : "left-0.5 bg-red-500"}`} />
                    </div>
                </div>
                 <div className="p-4 flex justify-between items-center">
                    <span className="font-semibold text-text-main">Backend</span>
                    <span className="text-sm text-text-sub font-mono">Firebase</span>
                </div>
                 <div className="p-4 flex justify-between items-center">
                    <span className="font-semibold text-text-main">Version</span>
                    <span className="text-sm text-text-sub">v2.3.0</span>
                </div>
            </div>
        </div>

        <Button onClick={logout} variant="danger" className="mt-4">
            Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Settings;