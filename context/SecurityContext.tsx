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
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

// --- Lock Screen Overlay Component ---
const LockScreen: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center overscroll-none touch-none select-none">
        {/* Abstract Background */}
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-primary/10 via-transparent to-purple-600/10 opacity-50 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center animate-scale-in gap-8">
            <div className="w-24 h-24 rounded-full bg-surface/50 backdrop-blur-lg border border-white/10 shadow-2xl flex items-center justify-center animate-pulse cursor-pointer" onClick={onUnlock}>
                 <Icons.Fingerprint className="w-12 h-12 text-primary" />
            </div>
            
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-black text-text-main tracking-tight">Chatlix Locked</h1>
                <p className="text-text-sub opacity-60 text-sm">Unlock to access your messages</p>
            </div>

            <button 
                onClick={onUnlock}
                className="mt-4 px-8 py-3 bg-surface-highlight rounded-xl text-primary font-bold text-sm hover:bg-primary/10 transition-colors border border-primary/20"
            >
                Use Biometrics
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
  const [isReady, setIsReady] = useState(false); // Blocks rendering until we check storage
  
  // Guard to prevent re-locking when app resumes from the biometric prompt itself
  const isVerifying = useRef(false);

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

                // Lock immediately if enabled and user exists (Cold Start)
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
      
      console.log("[Security] Starting verifyIdentity...");
      isVerifying.current = true;
      
      try {
          // NativeBiometric.verifyIdentity returns void on success, throws on failure.
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
          // Add a small delay before clearing the flag to handle the race condition
          // where the app resume event fires slightly after the promise resolves
          setTimeout(() => {
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
      }
  }, [verifyIdentity]);

  // Attempt to auto-unlock when lock screen appears
  useEffect(() => {
      let isMounted = true;
      
      if (isLocked && isSupported && isBiometricEnabled) {
          console.log("[Security] Auto-unlock triggering in 500ms...");
          // Add a small delay to ensure UI is ready and prevent potential race conditions with app resume
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
      // Always verify identity before changing security settings
      const verified = await verifyIdentity();
      
      if (verified) {
          const newState = !isBiometricEnabled;
          setIsBiometricEnabled(newState);
          await SecureStorage.set(BIOMETRIC_PREF_KEY, String(newState));
          console.log("[Security] Toggled to:", newState);
      }
  };

  if (!isReady) {
      // Prevent flash of content before we know if we should lock
      return <div className="fixed inset-0 bg-background" />;
  }

  return (
    <SecurityContext.Provider value={{ isLocked, isSupported, isBiometricEnabled, toggleBiometric, unlock }}>
      {children}
      {isLocked && user && <LockScreen onUnlock={unlock} />}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
};