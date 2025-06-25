// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBoC6bnyBSpyvvY23Db2ZaD_mKtEg5agP8",
  authDomain: "overlap-ing-0-0-1alpha.firebaseapp.com",
  projectId: "overlap-ing-0-0-1alpha",
  storageBucket: "overlap-ing-0-0-1alpha.firebasestorage.app",
  messagingSenderId: "712726920525",
  appId: "1:712726920525:web:a2a5d0a9d280fcd5d78b04"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
