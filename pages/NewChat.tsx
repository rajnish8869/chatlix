
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { TopBar, Icons, FAB, BottomSheet, Input, Button } from '../components/AndroidUI';

const NewChat: React.FC = () => {
  const { contacts, loadContacts, createChat } = useData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Group Name Modal State
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
          // Open Modal for Group Name
          setGroupName('');
          setShowNameModal(true);
      } else {
          // Direct 1-on-1
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
    } else {
        alert("Failed to create chat");
    }
  };
  
  const filteredContacts = contacts.filter(c => c.username.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div 
      className="flex-1 bg-background text-text-main min-h-screen flex flex-col"
    >
      <TopBar 
        title={selectedIds.size > 0 ? `${selectedIds.size} Selected` : "New Chat"} 
        onBack={() => navigate(-1)} 
        actions={
            selectedIds.size > 0 && (
                <button 
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full"
                >
                    Clear
                </button>
            )
        }
      />
      
      {/* Search Bar */}
      <div className="px-4 py-3 bg-background sticky top-16 z-10 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
         <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-text-sub"><Icons.Search /></span>
            <input 
                autoFocus
                className="bg-transparent border-none focus:outline-none w-full text-text-main placeholder-text-sub"
                placeholder="Search people..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
         </div>
      </div>
      
      <div className="flex-1 px-4 pb-24 overflow-y-auto no-scrollbar pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
        {loading && <div className="text-center text-primary text-sm font-medium py-8 animate-pulse">Creating conversation...</div>}
        
        <h2 className="text-xs text-text-sub font-bold mb-4 mt-2 uppercase tracking-wider ml-2">Suggested</h2>
        
        <div className="space-y-3">
            {filteredContacts.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center mt-12 text-text-sub opacity-60">
                    <p className="mt-2 text-sm font-medium">No contacts found</p>
                </div>
            )}

            {filteredContacts.map(user => {
                const isSelected = selectedIds.has(user.user_id);
                return (
                    <div 
                        key={user.user_id}
                        onClick={() => toggleSelection(user.user_id)}
                        className={`
                            flex items-center gap-4 p-4 rounded-2xl active:scale-[0.98] transition-all border border-border shadow-sm cursor-pointer
                            ${isSelected ? 'bg-primary/10 border-primary' : 'bg-surface'}
                        `}
                    >
                        <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border transition-colors
                            ${isSelected ? 'bg-primary text-primary-fg border-primary' : 'bg-gradient-to-br from-secondary to-surface-highlight text-text-main border-border'}
                        `}>
                            {isSelected ? <Icons.Check /> : user.username[0]}
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-bold text-[16px] ${isSelected ? 'text-primary' : 'text-text-main'}`}>{user.username}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} />
                                <p className="text-xs text-text-sub font-medium">{user.status}</p>
                            </div>
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
          <div 
              className="fixed bottom-6 right-5 z-40 animate-bounce-in"
              style={{
                  bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
                  right: 'calc(1.25rem + env(safe-area-inset-right))'
              }}
          >
             <button 
                onClick={handleFabClick}
                className="h-14 px-6 bg-primary text-primary-fg rounded-2xl shadow-glow flex items-center gap-3 font-bold tap-active"
             >
                <Icons.Chat />
                <span>
                    {selectedIds.size === 1 ? 'Start Chat' : `Create Group (${selectedIds.size})`}
                </span>
             </button>
          </div>
      )}

      {/* Group Name Modal */}
      <BottomSheet isOpen={showNameModal} onClose={() => setShowNameModal(false)}>
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold text-text-main">Name your group</h3>
            <p className="text-text-sub text-sm">Give this conversation a name so it's easier to find later.</p>
            
            <Input 
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Family Trip, Project Team"
                className="mt-2"
            />
            
            <div className="flex gap-3 mt-4">
                <Button variant="secondary" onClick={() => setShowNameModal(false)}>Cancel</Button>
                <Button 
                    variant="primary" 
                    onClick={() => createConversation(groupName.trim() || 'Group Chat')}
                >
                    Create Group
                </Button>
            </div>
        </div>
      </BottomSheet>
    </div>
  );
};

export default NewChat;
