
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
        {/* Animated Background */}
        <div className="absolute top-[-20%] left-[-20%] w-[100%] h-[60%] bg-primary/20 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[100%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />

        {/* Brand Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 animate-fade-in pb-32">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-primary to-purple-600 shadow-glow mb-8 flex items-center justify-center rotate-3 transform hover:rotate-6 transition-transform duration-500">
                 <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" /></svg>
            </div>
            <h1 className="text-4xl font-black text-text-main tracking-tight mb-2">Chatlix</h1>
            <p className="text-text-sub text-center font-medium opacity-80">Seamless & Secure Messaging</p>
        </div>

        {/* Floating Card */}
        <div className="bg-surface/60 backdrop-blur-xl border-t border-white/10 rounded-t-[48px] p-8 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-20 animate-slide-up">
             
             {/* Toggle Switch */}
             <div className="flex p-1 bg-surface-highlight/50 rounded-2xl mb-8 relative">
                 <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-surface shadow-sm rounded-xl transition-all duration-300 ease-out ${isLogin ? 'left-1' : 'left-[calc(50%+2px)]'}`} />
                 <button 
                    onClick={() => { setIsLogin(true); setError(''); }}
                    className={`flex-1 py-3 text-sm font-bold z-10 transition-colors ${isLogin ? 'text-primary' : 'text-text-sub'}`}
                 >
                    Log In
                </button>
                <button 
                    onClick={() => { setIsLogin(false); setError(''); }}
                    className={`flex-1 py-3 text-sm font-bold z-10 transition-colors ${!isLogin ? 'text-primary' : 'text-text-sub'}`}
                >
                    Sign Up
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

                {error && <p className="text-danger text-sm text-center font-semibold bg-danger/5 p-3 rounded-2xl border border-danger/10">{error}</p>}

                <Button type="submit" disabled={loading} className="mt-6 text-lg">
                    {loading ? <span className="opacity-80">Please wait...</span> : (isLogin ? 'Get Started' : 'Create Account')}
                </Button>
            </form>
            
            <p className="text-center text-xs text-text-sub mt-8 opacity-50 pb-4">
                Version 3.1 • Secure End-to-End
            </p>
        </div>
    </div>
  );
};

export default Login;
