
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { TopBar, Icons, BottomSheet, Input, Button, Avatar } from '../components/AndroidUI';

const NewChat: React.FC = () => {
  const { contacts, loadContacts, createChat } = useData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [showNameModal, setShowNameModal] = useState(false);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line
  }, []);

  const toggleSelection = (userId: string) => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(userId)) next.delete(userId);
          else next.add(userId);
          return next;
      });
  };

  const handleFabClick = () => {
      if (selectedIds.size === 0) return;
      if (selectedIds.size > 1) {
          setGroupName('');
          setShowNameModal(true);
      } else {
          createConversation();
      }
  };

  const createConversation = async (name?: string) => {
    setLoading(true);
    setShowNameModal(false);
    const chatId = await createChat(Array.from(selectedIds), name);
    setLoading(false);
    if (chatId) {
        navigate(`/chat/${chatId}`, { replace: true });
    }
  };
  
  const filteredContacts = contacts.filter(c => c.username.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 bg-background text-text-main min-h-screen flex flex-col">
      <TopBar 
        title={selectedIds.size > 0 ? `${selectedIds.size} selected` : "New Chat"} 
        onBack={() => navigate(-1)} 
        actions={
            selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
                    Reset
                </button>
            )
        }
      />
      
      <div className="px-4 py-2 sticky top-14 z-20 bg-background/95 backdrop-blur-sm">
         <Input 
            autoFocus
            placeholder="Search people..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
         />
      </div>
      
      <div className="flex-1 px-4 pb-28 pt-2 overflow-y-auto no-scrollbar">
        <h2 className="text-xs text-text-sub font-bold mb-4 mt-2 uppercase tracking-wider ml-2">Contacts</h2>
        
        <div className="space-y-2">
            {filteredContacts.map(user => {
                const isSelected = selectedIds.has(user.user_id);
                return (
                    <div 
                        key={user.user_id}
                        onClick={() => toggleSelection(user.user_id)}
                        className={`
                            flex items-center gap-4 p-3 rounded-[20px] active:scale-[0.98] transition-all cursor-pointer border
                            ${isSelected ? 'bg-primary/10 border-primary' : 'bg-surface border-transparent hover:bg-surface-highlight'}
                        `}
                    >
                        <Avatar name={user.username} size="md" online={user.status === 'online'} />
                        <div className="flex-1">
                            <h3 className={`font-bold text-base ${isSelected ? 'text-primary' : 'text-text-main'}`}>{user.username}</h3>
                            <p className="text-xs text-text-sub font-medium">{user.status}</p>
                        </div>
                        
                        <div className={`
                            w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                            ${isSelected ? 'bg-primary border-primary' : 'border-text-sub/30'}
                        `}>
                            {isSelected && <span className="text-white scale-75"><Icons.Check /></span>}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 right-5 z-40 animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
             <button 
                onClick={handleFabClick}
                className="h-14 px-6 bg-primary text-white rounded-2xl shadow-glow flex items-center gap-3 font-bold tap-active hover:scale-105 transition-transform"
             >
                <Icons.Chat />
                <span>{selectedIds.size === 1 ? 'Start Chat' : 'Create Group'}</span>
             </button>
          </div>
      )}

      <BottomSheet isOpen={showNameModal} onClose={() => setShowNameModal(false)}>
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold text-text-main">Group Name</h3>
            <Input 
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. The Squad"
            />
            <Button variant="primary" onClick={() => createConversation(groupName.trim() || 'Group Chat')}>
                Create Group
            </Button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default NewChat;
