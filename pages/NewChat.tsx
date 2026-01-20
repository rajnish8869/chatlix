import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { TopBar } from '../components/AndroidUI';

const NewChat: React.FC = () => {
  const { contacts, loadContacts, createChat } = useData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line
  }, []);

  const handleCreate = async (userId: string) => {
    setLoading(true);
    const chatId = await createChat([userId]);
    setLoading(false);
    if (chatId) {
        navigate(`/chat/${chatId}`, { replace: true });
    } else {
        alert("Failed to create chat");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="New Chat" onBack={() => navigate(-1)} />
      
      <div className="p-4">
        {loading && <div className="text-center text-primary mb-4">Creating chat...</div>}
        
        <h2 className="text-sm text-gray-400 font-medium mb-2 uppercase tracking-wider">Contacts</h2>
        
        <div className="space-y-2">
            {contacts.length === 0 && !loading && (
                <p className="text-gray-500 text-center mt-10">No contacts found.</p>
            )}

            {contacts.map(user => (
                <div 
                    key={user.user_id}
                    onClick={() => handleCreate(user.user_id)}
                    className="flex items-center gap-4 p-4 bg-surface rounded-xl active:bg-surface/70 transition-colors"
                >
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-white">
                        {user.username[0]}
                    </div>
                    <div>
                        <h3 className="font-medium">{user.username}</h3>
                        <p className="text-xs text-gray-400">{user.status}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default NewChat;