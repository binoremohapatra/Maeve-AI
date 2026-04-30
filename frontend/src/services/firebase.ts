import { database } from '../utils/firebase';
import { ref, onValue, set, push, off } from 'firebase/database';

export interface ChatData {
  id?: string;
  message: string;
  sender: string;
  timestamp: string | number; //  Accept both String and Number
  audioBase64?: string; // Audio field add kiya
  [key: string]: any;   // Extra data allow kiya
}

export const firebaseService = {
  // 1. Chat Logic
  listenForChat: (userId: string, callback: (messages: ChatData[]) => void) => {
    const chatRef = ref(database, `users/${userId}/chats`);
    onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const messages = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        callback(messages);
      } else {
        callback([]);
      }
    }); // Fixed: Missing brace was right here
    return () => off(chatRef);
  },

  sendChatMessage: async (userId: string, message: string, timestamp: number = Date.now()) => {
    const chatRef = ref(database, `users/${userId}/chats`);
    //  timestamp अब सीधे Number पास होगा
    await push(chatRef, { message, sender: 'user', timestamp: timestamp });
  },

  // Life & Care Stats
  saveLifeStats: async (userId: string, stats: any) => {
    await set(ref(database, `users/${userId}/lifeStats`), { ...stats, lastUpdate: new Date().toISOString() });
  },

  listenForLifeStats: (userId: string, callback: (stats: any) => void) => {
    onValue(ref(database, `users/${userId}/lifeStats`), (s) => s.exists() && callback(s.val()));
  },

  saveCareStats: async (userId: string, stats: any) => {
    await set(ref(database, `users/${userId}/careStats`), stats);
  },

  listenForCareStats: (userId: string, callback: (stats: any) => void) => {
    onValue(ref(database, `users/${userId}/careStats`), (s) => s.exists() && callback(s.val()));
  },

  // Profile & Memory
  saveUserProfile: async (userId: string, profile: any) => {
    await set(ref(database, `users/${userId}/profile`), profile);
  },

  listenForUserProfile: (userId: string, callback: (profile: any) => void) => {
    onValue(ref(database, `users/${userId}/profile`), (s) => s.exists() && callback(s.val()));
  },

  saveLearnedFacts: async (userId: string, facts: string[]) => {
    await set(ref(database, `users/${userId}/memory`), facts);
  },

  listenForFacts: (userId: string, callback: (facts: string[]) => void) => {
    onValue(ref(database, `users/${userId}/memory`), (s) => callback(s.exists() ? s.val() : []));
  },

  // Schedule
  saveSchedule: async (userId: string, schedule: any[]) => {
    await set(ref(database, `users/${userId}/schedule`), schedule);
  },

  listenForSchedule: (userId: string, callback: (data: any[]) => void) => {
    const date = new Date().toISOString().split('T')[0];
    const scheduleRef = ref(database, `users/${userId}/schedule/${date}`);
    onValue(scheduleRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : []);
    });
    return () => off(scheduleRef);
  },

  //  Neural Points System
  saveNeuralPoints: async (userId: string, points: number) => {
    await set(ref(database, `users/${userId}/neuralPoints`), points);
  },

  listenForNeuralPoints: (userId: string, callback: (points: number) => void) => {
    onValue(ref(database, `users/${userId}/neuralPoints`), (s) => callback(s.exists() ? s.val() : 0));
  }
}; // Final closing of the object - no trailing comma error here.
