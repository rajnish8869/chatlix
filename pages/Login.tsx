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
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background transition-colors">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
            <h1 className="text-4xl font-extrabold mb-2 text-primary tracking-tight">Chatlix</h1>
            <p className="text-text-sub font-medium">
                {isLogin ? "Welcome back" : "Create your account"}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-text-sub mb-1.5 ml-1 uppercase">Username</label>
              <Input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                placeholder="JohnDoe" 
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-text-sub mb-1.5 ml-1 uppercase">Email</label>
            <Input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-sub mb-1.5 ml-1 uppercase">Password</label>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-4 shadow-xl shadow-primary/20">
            {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In' : 'Sign Up')}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-text-sub">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-primary font-bold hover:underline focus:outline-none"
            >
                {isLogin ? "Sign Up" : "Log In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;