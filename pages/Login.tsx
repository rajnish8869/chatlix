
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/AndroidUI';

const Login: React.FC = () => {
  const { login, signup } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password || (!isLogin && !username)) {
        setError("Please fill in all fields");
        return;
    }

    setLoading(true);
    let result;
    if (isLogin) {
        result = await login(email, password);
    } else {
        result = await signup(username, email, password);
    }

    if (!result.success) {
      setError(result.error || (isLogin ? 'Login failed' : 'Sign up failed'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
        {/* Background Decorative Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[40%] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />

        {/* Brand Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 animate-fade-in">
            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-primary to-purple-600 shadow-glow mb-6 flex items-center justify-center rotate-3">
                 <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" /></svg>
            </div>
            <h1 className="text-4xl font-extrabold text-text-main tracking-tight mb-2">Chatlix</h1>
            <p className="text-text-sub text-center max-w-[200px]">The secure way to connect with your friends.</p>
        </div>

        {/* Auth Form Container */}
        <div className="bg-surface/80 backdrop-blur-xl rounded-t-[40px] border-t border-white/5 p-8 shadow-2xl z-20 animate-slide-up">
             <div className="w-12 h-1.5 bg-surface-highlight rounded-full mx-auto mb-8 opacity-50" />
             
             <div className="flex gap-8 mb-8 border-b border-border">
                <button 
                    onClick={() => { setIsLogin(true); setError(''); }}
                    className={`flex-1 pb-4 text-sm font-bold tracking-wide transition-all ${isLogin ? 'text-primary border-b-2 border-primary' : 'text-text-sub'}`}
                >
                    LOG IN
                </button>
                <button 
                    onClick={() => { setIsLogin(false); setError(''); }}
                    className={`flex-1 pb-4 text-sm font-bold tracking-wide transition-all ${!isLogin ? 'text-primary border-b-2 border-primary' : 'text-text-sub'}`}
                >
                    SIGN UP
                </button>
             </div>

             <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                    <div className="animate-fade-in">
                        <Input 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username" 
                        />
                    </div>
                )}
                
                <Input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address" 
                />

                <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" 
                />

                {error && <p className="text-danger text-xs text-center font-medium bg-danger/10 p-3 rounded-xl">{error}</p>}

                <Button type="submit" disabled={loading} className="mt-4">
                    {loading ? <span className="animate-pulse">Processing...</span> : (isLogin ? 'Welcome Back' : 'Create Account')}
                </Button>
            </form>
            
            <p className="text-center text-xs text-text-sub mt-6 opacity-60">
                By continuing, you agree to our Terms of Service.
            </p>
        </div>
    </div>
  );
};

export default Login;
