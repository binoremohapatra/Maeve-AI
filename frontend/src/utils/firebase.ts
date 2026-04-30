import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

//  TERE SCREENSHOT SE LIYA HUA CONFIG (Hardcoded for Safety)
const firebaseConfig = {
  apiKey: "AIzaSyByYZLpZnJkxTkzaDmdgTcN12rvYDYsA4ww",
  authDomain: "maeve-ai-core.firebaseapp.com",
  databaseURL: "https://maeve-ai-core-default-rtdb.firebaseio.com", // Ye zaroori hai!
  projectId: "maeve-ai-core",
  storageBucket: "maeve-ai-core.firebasestorage.app",
  messagingSenderId: "134164428223",
  appId: "1:134164428223:web:7fae8c0988121a84901d0a",
  measurementId: "G-70GN7XWPPC"
};

// Singleton Logic
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const database = getDatabase(app);

export default app;
