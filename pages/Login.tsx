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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold mb-2 text-primary">SheetChat</h1>
        <p className="text-gray-400 mb-8">
            {isLogin ? "Welcome back! Sign in to continue." : "Create an account to get started."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <Input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                placeholder="JohnDoe" 
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <Input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" 
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
            />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-900/10 p-2 rounded">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-4">
            {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In' : 'Sign Up')}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-400">
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