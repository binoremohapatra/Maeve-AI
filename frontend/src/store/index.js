import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  mascot: {
    speaking: false,
    replyText: '',
    loading: false,
    action: 'IDLE'
  },
  activeModule: 'dashboard',
  
  addChatMessage: (role, message) => {
    console.log(`Chat message: ${role}: ${message}`);
  },
  
  setMascotResponse: (response) => {
    set(state => ({
      mascot: {
        ...state.mascot,
        replyText: response.replyText || '',
        action: response.mascotAction || 'IDLE',
        speaking: true
      }
    }));
  },
  
  setActiveModule: (module) => {
    set({ activeModule: module });
  }
}));

export { useAppStore };
 