import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Login from './pages/Login';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import Settings from './pages/Settings';
import NewChat from './pages/NewChat';
import { BottomNav } from './components/AndroidUI';

// Wrapper to handle layout logic that depends on hooks
const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'chats' | 'settings'>('chats');
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="h-screen w-screen bg-background flex items-center justify-center">Loading...</div>;
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
    <div className="bg-background text-white min-h-screen">
      <Routes>
        <Route path="/" element={<ChatList />} />
        <Route path="/new-chat" element={<NewChat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/chat/:chatId" element={<ChatDetail />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      
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
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (location.pathname !== '/') {
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
    <AuthProvider>
      <DataProvider>
        <HashRouter>
            <AndroidBackButtonHandler />
            <AppLayout />
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;