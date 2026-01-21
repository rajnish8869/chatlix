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

// Initialize Firebase
// Check if app is already initialized to prevent errors in hot-reload environments
const app = (getApps && getApps().length > 0) ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);

// Use initializeFirestore with persistentLocalCache to avoid legacy persistence warnings
// and ensure robust offline support without multi-tab locks.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export { app, auth, db };