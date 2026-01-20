import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { TopBar, Button } from '../components/AndroidUI';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { settings } = useData();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar title="Settings" />
      
      <div className="p-6 space-y-8">
        {/* User Profile Card */}
        <div className="bg-surface rounded-2xl p-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-gray-600 rounded-full mb-4 flex items-center justify-center text-2xl font-bold text-white">
                {user?.username[0].toUpperCase()}
            </div>
            <h2 className="text-xl font-semibold text-white">{user?.username}</h2>
            <p className="text-gray-400">{user?.email}</p>
            <div className="mt-4 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-xs border border-green-800">
                {user?.status}
            </div>
        </div>

        {/* App Configs (Read-only from Sheet) */}
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider ml-1">App Configuration</h3>
            <div className="bg-surface/50 rounded-xl overflow-hidden divide-y divide-white/5 text-white">
                <div className="p-4 flex justify-between">
                    <span>Polling Interval</span>
                    <span className="text-gray-400">{settings.polling_interval / 1000}s</span>
                </div>
                <div className="p-4 flex justify-between">
                    <span>Group Chats</span>
                    <span className={settings.enable_groups ? "text-green-400" : "text-red-400"}>
                        {settings.enable_groups ? "Enabled" : "Disabled"}
                    </span>
                </div>
                 <div className="p-4 flex justify-between">
                    <span>Max Msg Length</span>
                    <span className="text-gray-400">{settings.max_message_length}</span>
                </div>
            </div>
        </div>

        <Button onClick={logout} variant="secondary" className="bg-red-900/20 text-red-400 hover:bg-red-900/30">
            Log Out
        </Button>
      </div>
    </div>
  );
};

export default Settings;