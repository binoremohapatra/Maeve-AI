import { create } from 'zustand';
import { ref, onValue, update } from 'firebase/database';
// Ensure this path matches where you saved the file above
import { database } from '../utils/firebase'; 

interface UserStatus {
  pc_local: boolean;
  last_ping: number | null;
  status: 'online' | 'offline' | 'away';
}

interface Command {
  id: string;
  status: string;
  [key: string]: any;
}

interface FirebaseStore {
  isConnected: boolean;
  userStatus: UserStatus;
  currentCommand: Command | null;
  commandHistory: Command[];
  voiceServerActive: boolean;
  initializeConnection: () => void;
  updateUserStatus: (status: Partial<UserStatus>) => void;
  clearCommand: (commandId: string) => void;
}

export const useFirebaseStore = create<FirebaseStore>((set) => ({
  // Connection status
  isConnected: false,
  
  // User status
  userStatus: {
    pc_local: false,
    last_ping: null,
    status: 'offline'
  },
  
  // Commands
  currentCommand: null,
  commandHistory: [],
  
  // Voice server status
  voiceServerActive: false,
  
  // Initialize Firebase connection
  initializeConnection: () => {
    const userRef = ref(database, 'users/user_pro_01/status');
    
    // Listen for connection status changes
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        set({
          userStatus: {
            pc_local: data.pc_local || false,
            last_ping: data.last_ping || null,
            status: data.status || 'offline'
          },
          isConnected: true
        });
      }
    });
    
    // Listen for commands
    const commandsRef = ref(database, 'users/user_pro_01/commands');
    onValue(commandsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object to array
        const commands = Object.entries(data).map(([id, cmd]: [string, any]) => ({ id, ...cmd }));
        const current = commands.find(cmd => cmd.status === 'PENDING');
        
        set({
          currentCommand: current || null,
          commandHistory: commands.reverse()
        });
      }
    });
  },
  
  // Update user status
  updateUserStatus: (status) => {
    const userRef = ref(database, 'users/user_pro_01/status');
    update(userRef, status);
  },
  
  // Clear command (mark as completed)
  clearCommand: (commandId) => {
    if (!commandId) return;
    const cmdRef = ref(database, `users/user_pro_01/commands/${commandId}`);
    update(cmdRef, { status: 'COMPLETED', completedAt: Date.now() });
  }
}));
