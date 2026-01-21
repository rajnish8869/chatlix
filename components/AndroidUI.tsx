
import React, { useEffect, useState } from 'react';

// --- Icons (Rounded & Clean) ---
export const Icons = {
  Back: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>,
  Send: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>,
  Plus: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  Settings: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Chat: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H21m-4.5 0c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  DoubleCheck: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6l-7.5 7.5 2.5 2.5m5-10l-7.5 7.5L6 10.5" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>,
  Info: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>,
};

// --- Avatar Component ---
export const Avatar: React.FC<{
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    online?: boolean;
    className?: string;
    showStatus?: boolean;
}> = ({ name, size = 'md', online, className, showStatus = true }) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-12 h-12 text-base',
        lg: 'w-16 h-16 text-xl',
        xl: 'w-24 h-24 text-4xl'
    };
    
    const colors = [
        'from-blue-500 to-cyan-500', 'from-emerald-500 to-teal-500', 
        'from-orange-500 to-amber-500', 'from-purple-500 to-violet-500', 
        'from-pink-500 to-rose-500', 'from-indigo-500 to-blue-500'
    ];
    
    // Consistent color based on name
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorClass = colors[hash % colors.length];

    return (
        <div className={`relative ${className}`}>
            <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colorClass} p-0.5 shadow-sm`}>
                <div className="w-full h-full rounded-full bg-surface-highlight/10 backdrop-blur-sm flex items-center justify-center font-bold text-white border border-white/10">
                    {name.charAt(0).toUpperCase()}
                </div>
            </div>
            {showStatus && online !== undefined && (
                <div className={`absolute bottom-0 right-0 rounded-full border-2 border-surface ${size === 'xl' ? 'w-6 h-6 border-4' : 'w-3.5 h-3.5'} ${online ? 'bg-green-500' : 'bg-surface-highlight'}`} />
            )}
        </div>
    );
};

// --- Top Bar (Glass) ---
export const TopBar: React.FC<{ 
  title: React.ReactNode; 
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  transparent?: boolean;
  onClickTitle?: () => void;
}> = ({ title, onBack, actions, className, transparent = false, onClickTitle }) => (
  <div className={`
    sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-all duration-300
    ${transparent ? 'bg-transparent' : 'glass-panel border-b border-border shadow-sm'}
    ${className}
  `}>
    <div className="h-14 flex items-center w-full gap-2 pl-3 pr-4">
      {onBack && (
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center text-text-main hover:bg-surface-highlight/50 tap-active transition-colors">
          <Icons.Back />
        </button>
      )}
      <div 
        className={`flex-1 min-w-0 flex flex-col justify-center ${onClickTitle ? 'cursor-pointer active:opacity-70 transition-opacity' : ''} ${!onBack ? 'pl-2' : ''}`}
        onClick={onClickTitle}
      >
        {typeof title === 'string' ? (
             <h1 className="text-lg font-bold text-text-main truncate">{title}</h1>
        ) : (
            title
        )}
      </div>
      {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
      )}
    </div>
  </div>
);

// --- FAB ---
export const FAB: React.FC<{ onClick: () => void; icon?: React.ReactNode }> = ({ onClick, icon }) => (
  <button 
    onClick={onClick}
    className="fixed w-14 h-14 bg-primary text-primary-fg rounded-2xl shadow-glow shadow-primary/40 flex items-center justify-center tap-active z-30 transition-transform duration-300 hover:scale-105 active:scale-95"
    style={{ 
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        right: '1.5rem' 
    }} 
  >
    {icon || <Icons.Plus />}
  </button>
);

// --- Scroll Down FAB ---
export const ScrollDownFab: React.FC<{ onClick: () => void, visible: boolean }> = ({ onClick, visible }) => (
  <button 
    onClick={onClick}
    className={`
      fixed w-10 h-10 bg-surface/80 backdrop-blur text-primary border border-border rounded-full shadow-lg flex items-center justify-center tap-active z-30 transition-all duration-300
      ${visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}
    `}
    style={{ 
        bottom: 'calc(6rem + env(safe-area-inset-bottom))',
        right: '1.5rem' 
    }}
  >
    <Icons.ChevronDown />
  </button>
);

// --- Bottom Navigation (Glass) ---
export const BottomNav: React.FC<{ activeTab: 'chats' | 'settings'; onTabChange: (t: 'chats' | 'settings') => void }> = ({ activeTab, onTabChange }) => (
  <div className="fixed bottom-0 left-0 w-full glass-panel border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
    <div className="h-[65px] flex items-center justify-around px-6">
      <button 
        onClick={() => onTabChange('chats')}
        className={`flex flex-col items-center justify-center gap-1 w-20 py-2 rounded-2xl transition-all ${activeTab === 'chats' ? 'text-primary' : 'text-text-sub opacity-70 hover:opacity-100'}`}
      >
        <div className={`p-1 rounded-xl transition-all ${activeTab === 'chats' ? 'bg-primary/10' : ''}`}>
           <Icons.Chat />
        </div>
        <span className="text-[10px] font-semibold">Chats</span>
      </button>
      <button 
        onClick={() => onTabChange('settings')}
        className={`flex flex-col items-center justify-center gap-1 w-20 py-2 rounded-2xl transition-all ${activeTab === 'settings' ? 'text-primary' : 'text-text-sub opacity-70 hover:opacity-100'}`}
      >
         <div className={`p-1 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-primary/10' : ''}`}>
          <Icons.Settings />
        </div>
        <span className="text-[10px] font-semibold">Settings</span>
      </button>
    </div>
  </div>
);

// --- Input Field (Pill) ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <div className="relative w-full">
    <input 
      {...props}
      className={`w-full bg-surface-highlight text-text-main border-none rounded-full px-5 py-3.5 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all placeholder:text-text-sub/70 shadow-inner ${props.className}`}
    />
  </div>
);

// --- Button (Pill) ---
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }> = ({ variant = 'primary', className, ...props }) => {
  let baseClass = "w-full py-3.5 rounded-full font-bold tracking-wide transition-all tap-active disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center shadow-md";
  let colorClass = "";
  
  switch(variant) {
    case 'primary': colorClass = "bg-primary text-primary-fg shadow-primary/30 hover:shadow-primary/50"; break;
    case 'secondary': colorClass = "bg-surface text-text-main border border-border hover:bg-surface-highlight"; break;
    case 'danger': colorClass = "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 shadow-none"; break;
  }

  return (
    <button 
      {...props}
      className={`${baseClass} ${colorClass} ${className}`}
    />
  );
}

// --- Bottom Sheet ---
export const BottomSheet: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  children: React.ReactNode 
}> = ({ isOpen, onClose, children }) => {
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setRender(false);
  };

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose}
      />
      <div 
        className={`
            bg-surface w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-white/10 transform transition-transform duration-300 pointer-events-auto
            ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onTransitionEnd={handleAnimationEnd}
      >
        <div className="w-12 h-1 bg-surface-highlight rounded-full mx-auto mb-6" />
        {children}
      </div>
    </div>
  );
};

// --- Confirmation Modal ---
export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-xs rounded-[32px] p-6 shadow-2xl border border-white/5 animate-scale-in">
        <h3 className="text-lg font-bold text-text-main mb-2 text-center">{title}</h3>
        <p className="text-text-sub text-center mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full font-bold text-text-main bg-surface-highlight hover:bg-surface-highlight/80 text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-3 rounded-full font-bold text-white shadow-lg text-sm ${isDestructive ? 'bg-danger shadow-danger/30' : 'bg-primary shadow-primary/30'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
