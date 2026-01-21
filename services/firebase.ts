import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC8Usjvsc9urqgVMaU-j4chKvtzHRP55L0",
  authDomain: "chat-application-5c644.firebaseapp.com",
  projectId: "chat-application-5c644",
  storageBucket: "chat-application-5c644.firebasestorage.app",
  messagingSenderId: "508246099822",
  appId: "1:508246099822:web:c633b2552ed2ad16e0e37f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with Persistence (Offline Support)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export default app;