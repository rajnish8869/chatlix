
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/AndroidUI";

const Login: React.FC = () => {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      setError(result.error || (isLogin ? "Login failed" : "Sign up failed"));
    }
    setLoading(false);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background relative overflow-hidden overscroll-none touch-none">
      {/* Ambient Background Effects */}
      <div className="absolute top-[-30%] left-[-10%] w-[80%] h-[60%] bg-primary/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

      {/* Main Content Area: Logo & Branding - Takes remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] z-10 w-full min-h-0">
        <div className="animate-fade-in flex flex-col items-center justify-center">
          {/* Updated Logo: Chat Bubble Style */}
          <div className="w-28 h-28 rounded-[32px] bg-gradient-to-br from-primary via-indigo-500 to-purple-600 shadow-2xl shadow-primary/30 mb-6 flex items-center justify-center transform hover:scale-105 transition-transform duration-500 relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity" />
            <svg
              className="w-14 h-14 text-white drop-shadow-md"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              <path
                d="M8 10h8v2H8zm0-3h8v2H8z"
                className="text-primary/20 mix-blend-multiply" 
                fill="black"
                fillOpacity="0.2"
              />
            </svg>
          </div>
          
          <h1 className="text-4xl font-black text-text-main tracking-tighter text-center mb-1 drop-shadow-sm">
            Chatlix
          </h1>
          <p className="text-text-sub text-center font-bold opacity-70 text-sm tracking-wide">
            Seamless & Secure Messaging
          </p>
        </div>
      </div>

      {/* Bottom Form Sheet - Anchored to bottom */}
      <div className="w-full bg-surface/60 backdrop-blur-2xl border-t border-white/10 rounded-t-[40px] px-8 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-20 animate-slide-up flex flex-col items-center max-h-[85vh] overflow-y-auto no-scrollbar">
        
        {/* Toggle Switch */}
        <div className="flex p-1 bg-surface-highlight/50 rounded-xl mb-6 relative w-full max-w-xs mx-auto flex-shrink-0">
          <div
            className={`absolute top-[4px] bottom-[4px] w-[calc(50%-4px)] bg-white/10 shadow-md rounded-lg transition-all duration-300 ease-out ${isLogin ? "left-[4px]" : "left-[calc(50%+4px)]"}`}
          />
          <button
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors rounded-lg text-center ${isLogin ? "text-primary" : "text-text-sub"}`}
          >
            Log In
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors rounded-lg text-center ${!isLogin ? "text-primary" : "text-text-sub"}`}
          >
            Sign Up
          </button>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3.5 w-full max-w-xs mx-auto">
          {!isLogin && (
            <div className="animate-fade-in">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Full Name"
                className="text-center"
              />
            </div>
          )}

          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            autoComplete="email"
            className="text-center"
          />

          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="text-center"
          />

          {error && (
            <div className="text-danger text-xs text-center font-bold bg-danger/10 p-3 rounded-xl border border-danger/20 animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl font-bold tracking-wide transition-all tap-active disabled:opacity-50 disabled:pointer-events-none bg-gradient-to-r from-primary to-primary/90 text-primary-fg shadow-lg shadow-primary/30 hover:shadow-primary/40 text-sm mt-4 active:scale-[0.98]"
          >
            {loading ? (
              <span className="opacity-80">Please wait...</span>
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-text-sub mt-6 opacity-40 font-mono tracking-widest pb-4">
          v3.2 • ENCRYPTED
        </p>
      </div>
    </div>
  );
};

export default Login;