import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '../utils/storage';
import { useAuth } from './AuthContext';
import { Icons } from '../components/AndroidUI';

interface SecurityContextType {
  isLocked: boolean;
  isSupported: boolean;
  isBiometricEnabled: boolean;
  toggleBiometric: () => Promise<void>;
  unlock: () => Promise<void>;
  authError: string | null;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

// --- Lock Screen Overlay Component ---
const LockScreen: React.FC<{ onUnlock: () => void; error: string | null }> = ({ onUnlock, error }) => (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center overscroll-none touch-none select-none">
        {/* Abstract Background */}
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-primary/10 via-transparent to-purple-600/10 opacity-50 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center animate-scale-in gap-8">
            <div className="w-24 h-24 rounded-full bg-surface/50 backdrop-blur-lg border border-white/10 shadow-2xl flex items-center justify-center animate-pulse cursor-pointer" onClick={onUnlock}>
                 <Icons.Fingerprint className={`w-12 h-12 ${error ? 'text-danger' : 'text-primary'}`} />
            </div>
            
            <div className="text-center space-y-2 px-6">
                <h1 className="text-2xl font-black text-text-main tracking-tight">Chatlix Locked</h1>
                <p className={`text-sm ${error ? 'text-danger font-bold' : 'text-text-sub opacity-60'}`}>
                    {error || "Unlock to access your messages"}
                </p>
            </div>

            <button 
                onClick={onUnlock}
                className={`mt-4 px-8 py-3 rounded-xl font-bold text-sm transition-colors border ${error ? 'bg-danger/10 text-danger border-danger/20 hover:bg-danger/20' : 'bg-surface-highlight text-primary border-primary/20 hover:bg-primary/10'}`}
            >
                {error ? "Try Again" : "Use Biometrics"}
            </button>
        </div>

        <div className="absolute bottom-8 text-[10px] text-text-sub opacity-30 font-mono uppercase tracking-widest">
            Secured by Device
        </div>
    </div>
);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false); 
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Guard to prevent re-locking when app resumes from the biometric prompt
  const isVerifying = useRef(false);
  // Guard to prevent overlapping plugin calls
  const isBiometricPending = useRef(false);
  // Ref to hold the cleanup timeout so we can cancel it
  const verificationTimeoutRef = useRef<any>(null);

  const BIOMETRIC_PREF_KEY = 'chatlix_biometric_enabled';

  useEffect(() => {
    const initSecurity = async () => {
        console.log("[Security] Initializing...");
        if (!Capacitor.isNativePlatform()) {
            console.log("[Security] Not native platform, disabling biometrics.");
            setIsReady(true);
            return;
        }

        try {
            const result = await NativeBiometric.isAvailable();
            console.log("[Security] Biometric Support:", result.isAvailable);
            setIsSupported(result.isAvailable);

            if (result.isAvailable) {
                const pref = await SecureStorage.get(BIOMETRIC_PREF_KEY);
                console.log("[Security] Stored Preference:", pref);
                const enabled = pref === 'true';
                setIsBiometricEnabled(enabled);

                if (enabled) {
                    console.log("[Security] Cold start lock.");
                    setIsLocked(true);
                }
            }
        } catch (e) {
            console.error("[Security] Biometric init failed", e);
        } finally {
            setIsReady(true);
        }
    };

    initSecurity();
  }, []);

  // Handle App Lifecycle (Resume/Pause)
  useEffect(() => {
      if (!isSupported || !isBiometricEnabled) return;

      const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          console.log(`[Security] App State Change. Active: ${isActive}, IsVerifying: ${isVerifying.current}`);
          if (isActive) {
              // If we are currently in the middle of a verification flow, 
              // the app resume event is likely triggered by the biometric prompt closing.
              // We should NOT re-lock in this case.
              if (!isVerifying.current) {
                  console.log("[Security] App resumed and not verifying -> LOCKING");
                  setIsLocked(true);
              } else {
                  console.log("[Security] App resumed but verification in progress -> SKIPPING LOCK");
              }
          }
      });

      return () => {
          listener.then(handle => handle.remove());
      };
  }, [isSupported, isBiometricEnabled]);

  const verifyIdentity = useCallback(async (): Promise<boolean> => {
      if (!isSupported) {
          console.warn("[Security] Verify called but not supported");
          return false;
      }

      if (isBiometricPending.current) {
          console.log("[Security] Biometric call already pending, ignoring.");
          return false;
      }
      
      console.log("[Security] Starting verifyIdentity...");
      
      // Clear any pending cleanup timeout from a previous run
      if (verificationTimeoutRef.current) {
          clearTimeout(verificationTimeoutRef.current);
          verificationTimeoutRef.current = null;
      }

      isVerifying.current = true;
      isBiometricPending.current = true;
      setAuthError(null);
      
      try {
          await NativeBiometric.verifyIdentity({
              reason: "Unlock Chatlix",
              title: "Unlock Chatlix",
              subtitle: "Verify your identity",
              description: "Use your fingerprint or Face ID"
          });
          console.log("[Security] NativeBiometric resolved successfully.");
          return true;
      } catch (e) {
          console.warn("[Security] Verification failed or cancelled", e);
          return false;
      } finally {
          isBiometricPending.current = false;
          // Add a delay before clearing the 'isVerifying' flag. 
          // This ensures that if the 'appStateChange' event fires slightly after 
          // the promise resolves (or rejects), we still consider it part of the verification flow.
          verificationTimeoutRef.current = setTimeout(() => {
             isVerifying.current = false;
             console.log("[Security] Verification flag cleared.");
          }, 1000);
      }
  }, [isSupported]);

  const unlock = useCallback(async () => {
      console.log("[Security] Unlock requested.");
      const success = await verifyIdentity();
      console.log("[Security] Verify Result:", success);
      if (success) {
          console.log("[Security] Unlocking app state.");
          setIsLocked(false);
          setAuthError(null);
      } else {
          setAuthError("Authentication failed.");
      }
  }, [verifyIdentity]);

  // Attempt to auto-unlock when lock screen appears
  useEffect(() => {
      let isMounted = true;
      
      if (isLocked && isSupported && isBiometricEnabled) {
          console.log("[Security] Auto-unlock triggering in 500ms...");
          const timer = setTimeout(async () => {
              if (!isMounted) return;
              await unlock();
          }, 500);
          return () => {
              isMounted = false;
              clearTimeout(timer);
          };
      }
  }, [isLocked, isSupported, isBiometricEnabled, unlock]);

  const toggleBiometric = async () => {
      console.log("[Security] Toggling Biometric. Current:", isBiometricEnabled);
      const verified = await verifyIdentity();
      
      if (verified) {
          const newState = !isBiometricEnabled;
          setIsBiometricEnabled(newState);
          await SecureStorage.set(BIOMETRIC_PREF_KEY, String(newState));
          console.log("[Security] Toggled to:", newState);
      }
  };

  if (!isReady) {
      return <div className="fixed inset-0 bg-background" />;
  }

  return (
    <SecurityContext.Provider value={{ isLocked, isSupported, isBiometricEnabled, toggleBiometric, unlock, authError }}>
      {children}
      {isLocked && user && <LockScreen onUnlock={unlock} error={authError} />}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
};