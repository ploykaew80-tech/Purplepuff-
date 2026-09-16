import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDInNrhKJ9NMQFq3Rvk6WHJojRqXUzgOnA",
  authDomain: "purplepufff-1.firebaseapp.com",
  projectId: "purplepufff-1",
  storageBucket: "purplepufff-1.firebasestorage.app",
  messagingSenderId: "5228897423",
  appId: "1:5228897423:web:97d1cc1a6534a2a0dffcfa",
  measurementId: "G-VQWQ1GV46B"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
