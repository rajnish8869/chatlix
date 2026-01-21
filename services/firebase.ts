import * as firebase from "firebase/app";
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
export const app = firebase.initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable Offline Persistence
// Note: This promise might fail if multiple tabs are open, which is fine.
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: Not supported');
    }
});