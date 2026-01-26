import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { DatabaseProvider } from './context/DatabaseContext';
import { SecurityProvider } from './context/SecurityContext';
import { CallProvider } from './context/CallContext';
import Login from './pages/Login';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import ChatInfo from './pages/ChatInfo';
import Settings from './pages/Settings';
import NewChat from './pages/NewChat';
import CallList from './pages/CallList';
import { BottomNav } from './components/AndroidUI';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

// --- Splash Screen Component ---
const SplashScreen: React.FC = () => (
  <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 overflow-hidden touch-none select-none">
    {/* Ambient Glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none animate-pulse" />

    <div className="animate-scale-in flex flex-col items-center relative z-10">
      {/* Logo */}
      <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-primary via-indigo-500 to-purple-600 shadow-2xl shadow-primary/30 mb-6 flex items-center justify-center relative overflow-hidden animate-float">
          <div className="absolute inset-0 bg-white/10 opacity-20" />
          <svg
            className="w-12 h-12 text-white drop-shadow-md"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            <path
              d="M8 10h8v2H8zm0-3h8v2H8z"
              className="text-primary/20 mix-blend-multiply" 
              fill="black"
              fillOpacity="0.2"
            />
          </svg>
      </div>
      
      <h1 className="text-3xl font-black text-text-main tracking-tighter mb-8 drop-shadow-sm">
        Chatlix
      </h1>

      {/* Loading Indicator */}
      <div className="flex gap-2">
         <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
         <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
         <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
    
    <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] text-[10px] font-bold text-text-sub opacity-40 tracking-[0.2em] uppercase">
        Encrypted Messenger
    </div>
  </div>
);

// Wrapper to handle layout logic that depends on hooks
const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'chats' | 'settings' | 'calls'>('chats');
  const navigate = useNavigate();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Login />;
  }

  // Helper to sync tab state with navigation
  const handleTabChange = (tab: 'chats' | 'settings' | 'calls') => {
    setActiveTab(tab);
    if (tab === 'chats') navigate('/');
    if (tab === 'calls') navigate('/calls');
    if (tab === 'settings') navigate('/settings');
  };

  const getActiveTab = () => {
      if (location.pathname === '/calls') return 'calls';
      if (location.pathname === '/settings') return 'settings';
      return 'chats';
  };

  const showBottomNav = ['/', '/settings', '/calls'].includes(location.pathname);

  return (
    <div className="bg-background text-text-main h-full flex flex-col transition-colors duration-300 overflow-hidden">
      <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        <Routes>
          <Route path="/" element={<ChatList />} />
          <Route path="/calls" element={<CallList />} />
          <Route path="/new-chat" element={<NewChat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/chat/:chatId" element={<ChatDetail />} />
          <Route path="/chat/:chatId/info" element={<ChatInfo />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      
      {showBottomNav && (
        <BottomNav activeTab={getActiveTab()} onTabChange={handleTabChange} />
      )}
    </div>
  );
};

// Android Back Button & Notification Handler
const SystemEventsHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 1. Handle Hardware Back Button
    let backButtonListener: any;
    
    const setupBackListener = async () => {
        try {
            backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                const isRootScreen = location.pathname === '/' || location.pathname === '/login';
                if (isRootScreen) {
                    CapacitorApp.exitApp();
                } else {
                    navigate(-1);
                }
            });
        } catch (e) {
            console.warn("Back button handler failed", e);
        }
    };
    setupBackListener();

    // 2. Handle Push Notification Clicks
    // When user taps a notification in the tray
    let pushListener: any;
    const setupPushListener = async () => {
        try {
            pushListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                const data = notification.notification.data;
                if (data && data.chatId) {
                    console.log("Opening chat from notification:", data.chatId);
                    navigate(`/chat/${data.chatId}`);
                }
            });
        } catch(e) {
            console.warn("Push listener setup failed", e);
        }
    };
    setupPushListener();

    return () => {
        if (backButtonListener) backButtonListener.remove();
        if (pushListener) pushListener.remove();
    };
  }, [location, navigate]);

  // Dev fallback for ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (location.pathname !== '/' && location.pathname !== '/login') {
                navigate(-1);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location, navigate]);

  return null;
}

const App: React.FC = () => {
  return (
    <DatabaseProvider>
      <AuthProvider>
        <SecurityProvider>
          <DataProvider>
              <CallProvider>
                <ThemeProvider>
                  <HashRouter>
                      <SystemEventsHandler />
                      <AppLayout />
                  </HashRouter>
                </ThemeProvider>
            </CallProvider>
          </DataProvider>
        </SecurityProvider>
      </AuthProvider>
    </DatabaseProvider>
  );
};

export default App;