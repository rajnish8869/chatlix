import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TopBar, Icons } from '../components/AndroidUI';

const ChatInfo: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { chats, contacts, loadContacts } = useData();
  const { user } = useAuth();
  
  const currentChat = chats.find(c => c.chat_id === chatId);
  
  // Resolve participants
  // The 'contacts' list is usually all users. We map participant IDs to user objects.
  const participants = currentChat?.participants.map(id => {
      const contact = contacts.find(u => u.user_id === id);
      // If contact not found (e.g. self), fallback to basic info
      if (id === user?.user_id) return { ...user, isMe: true };
      return contact || { user_id: id, username: 'Unknown User', status: 'offline', isMe: false };
  }) || [];

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line
  }, []);

  if (!currentChat) {
      return <div className="flex-1 bg-background flex items-center justify-center">Chat not found</div>;
  }

  return (
    <div className="flex-1 bg-background text-text-main min-h-screen flex flex-col">
      <TopBar title="Chat Info" onBack={() => navigate(-1)} />
      
      <div className="flex-1 overflow-y-auto pb-10">
          
          {/* Header */}
          <div className="flex flex-col items-center py-10 border-b border-border/50">
             <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-purple-500 p-1 shadow-xl shadow-primary/20 mb-4">
                 <div className="w-full h-full bg-surface rounded-full flex items-center justify-center text-4xl font-bold text-text-main">
                     {currentChat.name ? currentChat.name[0].toUpperCase() : '#'}
                 </div>
             </div>
             <h2 className="text-2xl font-bold">{currentChat.name || "Conversation"}</h2>
             <p className="text-text-sub mt-1">{participants.length} Participants</p>
          </div>

          {/* Participants List */}
          <div className="p-4">
              <h3 className="text-xs font-bold text-text-sub uppercase tracking-wider mb-4 ml-2">Members</h3>
              <div className="bg-surface rounded-3xl border border-border overflow-hidden">
                  {participants.map((p: any, idx) => (
                      <div 
                        key={p.user_id}
                        className={`
                            flex items-center gap-4 p-4 
                            ${idx !== participants.length - 1 ? 'border-b border-border' : ''}
                        `}
                      >
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-text-main">
                              {p.username[0]}
                          </div>
                          <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-text-main">{p.username}</h4>
                                {p.isMe && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">YOU</span>}
                              </div>
                              <p className="text-xs text-text-sub">{p.email || p.status}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Actions */}
          <div className="px-4 mt-4 space-y-3">
              <button 
                className="w-full py-4 bg-surface text-red-500 font-bold rounded-2xl border border-border active:scale-[0.98] transition-all"
                onClick={() => navigate('/')}
              >
                  Close Chat
              </button>
          </div>
          
      </div>
    </div>
  );
};

export default ChatInfo;