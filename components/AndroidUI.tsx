
import React, { useEffect, useState } from 'react';

// --- Icons (Redesigned - Rounded & Softer) ---
export const Icons = {
  Back: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>,
  Send: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>,
  Plus: () => <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  Settings: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.467a23.782 23.782 0 00-4.673-4.703" /></svg>,
  Chat: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H21m-4.5 0c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
  Search: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  DoubleCheck: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6l-7.5 7.5 2.5 2.5m5-10l-7.5 7.5L6 10.5" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>,
  Copy: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5" /></svg>,
  Reply: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>,
  Info: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  Trash: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
};

// --- Top Bar ---
export const TopBar: React.FC<{ 
  title: React.ReactNode; 
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  transparent?: boolean;
  onClickTitle?: () => void;
}> = ({ title, onBack, actions, className, transparent = false, onClickTitle }) => (
  <div className={`
    sticky top-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-300
    ${transparent ? 'bg-transparent' : 'bg-background/90 backdrop-blur-md border-b border-border'}
    ${className}
  `}>
    <div className="h-16 flex items-center w-full gap-3 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
      {onBack && (
        <button onClick={onBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-text-main hover:bg-surface/50 tap-active">
          <Icons.Back />
        </button>
      )}
      <div 
        className={`flex-1 min-w-0 flex items-center ${onClickTitle ? 'cursor-pointer active:opacity-70 transition-opacity' : ''}`}
        onClick={onClickTitle}
      >
        {typeof title === 'string' ? (
             <h1 className="text-xl font-bold text-text-main truncate tracking-tight">{title}</h1>
        ) : (
            title
        )}
      </div>
      {actions && (
          <div className="flex items-center gap-1">
            {actions}
          </div>
      )}
    </div>
  </div>
);

// --- FAB ---
export const FAB: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button 
    onClick={onClick}
    className="fixed w-14 h-14 bg-primary text-primary-fg rounded-2xl shadow-glow flex items-center justify-center tap-active z-40 transition-transform duration-300 hover:scale-105"
    style={{ 
        bottom: 'calc(6rem + env(safe-area-inset-bottom))',
        right: 'calc(1.25rem + env(safe-area-inset-right))' 
    }} 
  >
    <Icons.Plus />
  </button>
);

// --- Scroll Down FAB ---
export const ScrollDownFab: React.FC<{ onClick: () => void, visible: boolean }> = ({ onClick, visible }) => (
  <button 
    onClick={onClick}
    className={`
      fixed w-10 h-10 bg-surface/90 backdrop-blur text-primary border border-border rounded-full shadow-lg flex items-center justify-center tap-active z-30 transition-all duration-300
      ${visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}
    `}
    style={{ 
        bottom: 'calc(5rem + env(safe-area-inset-bottom))',
        right: 'calc(1.25rem + env(safe-area-inset-right))' 
    }}
  >
    <Icons.ChevronDown />
  </button>
);

// --- Bottom Navigation ---
export const BottomNav: React.FC<{ activeTab: 'chats' | 'settings'; onTabChange: (t: 'chats' | 'settings') => void }> = ({ activeTab, onTabChange }) => (
  <div className="fixed bottom-0 left-0 w-full bg-surface/95 backdrop-blur-xl border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
    <div className="h-[70px] flex items-center justify-around px-6 pl-[calc(1.5rem+env(safe-area-inset-left))] pr-[calc(1.5rem+env(safe-area-inset-right))]">
      <button 
        onClick={() => onTabChange('chats')}
        className={`flex flex-col items-center justify-center gap-1 w-20 py-2 rounded-2xl transition-all ${activeTab === 'chats' ? 'text-primary bg-primary/10' : 'text-text-sub hover:bg-surface-highlight'}`}
      >
        <Icons.Chat />
        <span className="text-[10px] font-semibold">Chats</span>
      </button>
      <button 
        onClick={() => onTabChange('settings')}
        className={`flex flex-col items-center justify-center gap-1 w-20 py-2 rounded-2xl transition-all ${activeTab === 'settings' ? 'text-primary bg-primary/10' : 'text-text-sub hover:bg-surface-highlight'}`}
      >
        <Icons.Settings />
        <span className="text-[10px] font-semibold">Config</span>
      </button>
    </div>
  </div>
);

// --- Input Field ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <div className="relative w-full">
    <input 
      {...props}
      className={`w-full bg-surface text-text-main border border-border rounded-2xl px-5 py-4 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-text-sub shadow-sm ${props.className}`}
    />
  </div>
);

// --- Button ---
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }> = ({ variant = 'primary', className, ...props }) => {
  let baseClass = "w-full py-4 rounded-2xl font-bold tracking-wide transition-all tap-active disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center";
  let colorClass = "";
  
  switch(variant) {
    case 'primary': colorClass = "bg-primary text-primary-fg shadow-glow"; break;
    case 'secondary': colorClass = "bg-surface text-text-main border border-border hover:bg-surface-highlight"; break;
    case 'danger': colorClass = "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"; break;
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
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        className={`
            bg-surface w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-border transform transition-transform duration-300 pointer-events-auto
            ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onTransitionEnd={handleAnimationEnd}
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6 opacity-50" />
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
  const [visible, setVisible] = useState(false);
  const [rendering, setRendering] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
        setRendering(true);
        // Small delay to allow render before transition
        requestAnimationFrame(() => setVisible(true));
    } else {
        setVisible(false);
        const timer = setTimeout(() => setRendering(false), 200);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!rendering) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-6 transition-opacity duration-200 ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface w-full max-w-xs rounded-[32px] p-6 shadow-2xl border border-border/50 transform transition-all duration-200 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
            {isDestructive ? <Icons.Trash /> : <Icons.Info />}
        </div>
        <h3 className="text-xl font-bold text-text-main mb-2 text-center">{title}</h3>
        <p className="text-text-sub text-center mb-8 leading-relaxed text-sm">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl font-bold text-text-main bg-surface-highlight hover:bg-surface-highlight/80 transition-colors tap-active text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-white shadow-lg transition-transform tap-active text-sm flex items-center justify-center gap-2 ${isDestructive ? 'bg-red-500 shadow-red-500/30' : 'bg-primary shadow-primary/30'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
