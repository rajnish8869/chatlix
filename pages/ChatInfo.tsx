
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, Icons, Avatar } from '../components/AndroidUI';

const ChatInfo: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { chats, contacts, loadContacts } = useData();
  const { user } = useAuth();
  
  const currentChat = chats.find(c => c.chat_id === chatId);
  
  const participants = currentChat?.participants.map(id => {
      const contact = contacts.find(u => u.user_id === id);
      if (id === user?.user_id) return { ...user, isMe: true };
      return contact || { user_id: id, username: 'Unknown User', status: 'offline', isMe: false };
  }) || [];

  useEffect(() => { loadContacts(); }, []);

  if (!currentChat) return <div className="flex-1 bg-background flex items-center justify-center">Chat not found</div>;

  return (
    <div className="flex-1 bg-background text-text-main min-h-screen flex flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <TopBar title="Details" onBack={() => navigate(-1)} transparent />
      
      <div className="flex-1 overflow-y-auto pb-10" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>
          
          <div className="flex flex-col items-center pt-8 pb-12 px-6">
             <div className="mb-6 relative transform hover:scale-105 transition-transform duration-500">
                 <Avatar name={currentChat.name || "C"} size="xl" className="shadow-2xl shadow-primary/30" showStatus={false} />
             </div>
             <h2 className="text-3xl font-black tracking-tight text-center mb-3">{currentChat.name || "Conversation"}</h2>
             <span className="px-4 py-1.5 bg-surface-highlight border border-white/5 rounded-full text-xs font-bold text-text-sub tracking-wide uppercase">
                 {currentChat.type === 'group' ? 'Group Conversation' : 'Private Chat'}
             </span>
          </div>

          <div className="px-5 max-w-lg mx-auto">
              <h3 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-4 ml-4 opacity-70">Participants ({participants.length})</h3>
              <div className="bg-surface rounded-[32px] border border-white/5 overflow-hidden shadow-soft">
                  {participants.map((p: any, idx) => (
                      <div 
                        key={p.user_id}
                        className={`flex items-center gap-4 p-5 ${idx !== participants.length - 1 ? 'border-b border-white/5' : ''}`}
                      >
                          <Avatar name={p.username} size="md" online={p.status === 'online'} />
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-bold text-text-main text-lg truncate">{p.username}</h4>
                                {p.isMe && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">YOU</span>}
                              </div>
                              <p className="text-sm text-text-sub opacity-60 truncate">{p.email || p.status}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
          
      </div>
    </div>
  );
};

export default ChatInfo;
