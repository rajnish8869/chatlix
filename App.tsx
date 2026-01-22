
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import ChatInfo from './pages/ChatInfo';
import Settings from './pages/Settings';
import NewChat from './pages/NewChat';
import { BottomNav } from './components/AndroidUI';
import { App as CapacitorApp } from '@capacitor/app';

// Wrapper to handle layout logic that depends on hooks
const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'chats' | 'settings'>('chats');
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="h-screen w-screen bg-background text-text-main flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  // Helper to sync tab state with navigation
  const handleTabChange = (tab: 'chats' | 'settings') => {
    setActiveTab(tab);
    if (tab === 'chats') navigate('/');
    if (tab === 'settings') navigate('/settings');
  };

  const showBottomNav = location.pathname === '/' || location.pathname === '/settings';

  return (
    <div className="bg-background text-text-main min-h-screen flex flex-col transition-colors duration-300">
      <div className="flex-1 flex flex-col relative">
        <Routes>
          <Route path="/" element={<ChatList />} />
          <Route path="/new-chat" element={<NewChat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/chat/:chatId" element={<ChatDetail />} />
          <Route path="/chat/:chatId/info" element={<ChatInfo />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      
      {showBottomNav && (
        <BottomNav activeTab={location.pathname === '/settings' ? 'settings' : 'chats'} onTabChange={handleTabChange} />
      )}
    </div>
  );
};

// Android Back Button Logic Hook
const AndroidBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    // 1. Handle Hardware Back Button (Android)
    let backButtonListener: any;
    
    const setupListener = async () => {
        try {
            backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                // Determine if we are on a "root" screen where back should exit the app
                const isRootScreen = location.pathname === '/' || location.pathname === '/login';

                if (isRootScreen) {
                    CapacitorApp.exitApp();
                } else {
                    navigate(-1);
                }
            });
        } catch (e) {
            console.warn("Capacitor App plugin not available, back button handling skipped.");
        }
    };
    
    setupListener();

    // 2. Handle Escape Key (Dev/Browser fallback)
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (location.pathname !== '/' && location.pathname !== '/login') {
                navigate(-1);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        if (backButtonListener) backButtonListener.remove();
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [location, navigate]);

  return null;
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <ThemeProvider>
          <HashRouter>
              <AndroidBackButtonHandler />
              <AppLayout />
          </HashRouter>
        </ThemeProvider>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
