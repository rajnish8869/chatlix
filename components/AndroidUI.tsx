import React from 'react';

// --- Icons (SVG) ---
export const Icons = {
  Back: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Send: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Plus: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Settings: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Chat: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
};

// --- Top Bar ---
export const TopBar: React.FC<{ 
  title: string; 
  onBack?: () => void;
  actions?: React.ReactNode;
}> = ({ title, onBack, actions }) => (
  <div className="h-16 bg-surface shadow-md flex items-center px-4 sticky top-0 z-50">
    {onBack && (
      <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
        <Icons.Back />
      </button>
    )}
    <h1 className="text-xl font-medium flex-1 truncate">{title}</h1>
    {actions}
  </div>
);

// --- FAB ---
export const FAB: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button 
    onClick={onClick}
    className="fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-2xl shadow-lg shadow-black/50 flex items-center justify-center active:scale-90 transition-transform z-40"
  >
    <Icons.Plus />
  </button>
);

// --- Bottom Navigation ---
export const BottomNav: React.FC<{ activeTab: 'chats' | 'settings'; onTabChange: (t: 'chats' | 'settings') => void }> = ({ activeTab, onTabChange }) => (
  <div className="fixed bottom-0 left-0 w-full h-16 bg-surface border-t border-white/5 flex items-center justify-around z-50 pb-2">
    <button 
      onClick={() => onTabChange('chats')}
      className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'chats' ? 'text-primary' : 'text-gray-400'}`}
    >
      <Icons.Chat />
      <span className="text-xs mt-1">Chats</span>
    </button>
    <button 
      onClick={() => onTabChange('settings')}
      className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'settings' ? 'text-primary' : 'text-gray-400'}`}
    >
      <Icons.Settings />
      <span className="text-xs mt-1">Settings</span>
    </button>
  </div>
);

// --- Input Field ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input 
    {...props}
    className={`w-full bg-background border border-secondary/50 rounded-lg px-4 py-3 focus:border-primary focus:outline-none transition-colors ${props.className}`}
  />
);

// --- Button ---
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }> = ({ variant = 'primary', className, ...props }) => (
  <button 
    {...props}
    className={`w-full py-3 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${
      variant === 'primary' 
        ? 'bg-primary text-white shadow-lg shadow-primary/30' 
        : 'bg-secondary/30 text-gray-200'
    } ${className}`}
  />
);
