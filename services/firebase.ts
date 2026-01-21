
import * as firebaseApp from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

// Workaround for TypeScript error "Module 'firebase/app' has no exported member..."
// This can occur if type definitions are mismatched or in certain module resolution contexts.
const firebaseAppModule = firebaseApp as any;
const { initializeApp, getApps, getApp } = firebaseAppModule.default || firebaseAppModule;

const firebaseConfig = {
  apiKey: "AIzaSyC8Usjvsc9urqgVMaU-j4chKvtzHRP55L0",
  authDomain: "chat-application-5c644.firebaseapp.com",
  projectId: "chat-application-5c644",
  storageBucket: "chat-application-5c644.firebasestorage.app",
  messagingSenderId: "508246099822",
  appId: "1:508246099822:web:c633b2552ed2ad16e0e37f"
};

console.log("[Firebase] Initializing with config:", firebaseConfig.projectId);

// Initialize Firebase
// Check if app is already initialized to prevent errors in hot-reload environments
const app = (getApps && getApps().length > 0) ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);

// Use initializeFirestore with persistentLocalCache to avoid legacy persistence warnings.
// Added experimentalForceLongPolling: true to fix "Failed to get document because the client is offline"
// which is common in Android WebViews/Capacitor where WebSockets might be unstable.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  experimentalForceLongPolling: true
});

console.log("[Firebase] Services initialized (Auth, Firestore) with ForceLongPolling");

export { app, auth, db };
