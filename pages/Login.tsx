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
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="absolute top-[-30%] left-[-10%] w-[80%] h-[60%] bg-primary/15 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-3xl animate-pulse" />

      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="mb-12 animate-fade-in">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-primary/80 shadow-2xl shadow-primary/40 mb-6 flex items-center justify-center transform hover:scale-110 transition-transform duration-500 hover:shadow-primary/60">
            <svg
              className="w-16 h-16 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black text-text-main tracking-tighter text-center mb-2">
            Chatlix
          </h1>
          <p className="text-text-sub text-center font-semibold opacity-80 text-base">
            Seamless & Secure Messaging
          </p>
        </div>
      </div>

      <div className="bg-surface/60 backdrop-blur-2xl border-t border-white/10 rounded-t-[48px] p-8 shadow-2xl z-20 animate-slide-up">
        <div className="flex p-1.5 bg-surface-highlight/50 rounded-2xl mb-8 relative">
          <div
            className={`absolute top-[6px] bottom-[6px] w-[calc(50%-6px)] bg-white/10 shadow-lg rounded-xl transition-all duration-300 ease-out ${isLogin ? "left-[6px]" : "left-[calc(50%+6px)]"}`}
          />
          <button
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors rounded-lg ${isLogin ? "text-primary" : "text-text-sub"}`}
          >
            Log In
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors rounded-lg ${!isLogin ? "text-primary" : "text-text-sub"}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div className="animate-fade-in">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Full Name"
              />
            </div>
          )}

          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            autoComplete="email"
          />

          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
          />

          {error && (
            <div className="text-danger text-sm text-center font-semibold bg-danger/10 p-3.5 rounded-2xl border border-danger/20 animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold tracking-wide transition-all tap-active disabled:opacity-50 disabled:pointer-events-none bg-gradient-to-r from-primary to-primary/90 text-primary-fg shadow-lg shadow-primary/30 hover:shadow-primary/40 text-base mt-6"
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

        <p className="text-center text-xs text-text-sub mt-8 opacity-50 pb-2 font-mono">
          v3.2 • Encrypted • Secure
        </p>
      </div>
    </div>
  );
};

export default Login;
