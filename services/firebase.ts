import * as firebaseApp from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC8Usjvsc9urqgVMaU-j4chKvtzHRP55L0",
  authDomain: "chat-application-5c644.firebaseapp.com",
  projectId: "chat-application-5c644",
  storageBucket: "chat-application-5c644.firebasestorage.app",
  messagingSenderId: "508246099822",
  appId: "1:508246099822:web:c633b2552ed2ad16e0e37f"
};

// Initialize Firebase
// Use type casting to avoid "Module has no exported member" errors which can occur
// due to type definition conflicts (e.g. v8 types vs v9 runtime)
const api = firebaseApp as any;

const app = (api.getApps && api.getApps().length > 0) 
  ? api.getApp() 
  : api.initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firebase persistence failed: multiple tabs open');
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firebase persistence not supported');
    }
});

export { app, auth, db };