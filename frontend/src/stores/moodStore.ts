import { create } from 'zustand';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/EcosystemConfig';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firebaseService, ChatData } from '../services/firebase';
import { getCharacterFile, saveCharacterFile, deleteCharacterFile } from '../services/characterDb';
import { maeveAPI } from '../services/api';

// --- Interfaces & Types ---

interface UserProfile {
  name: string; age: number;
  role: 'student' | 'professional' | 'freelancer';
  field: string; height: number; weight: number;
}

export type PersonalityType = 'GOTH' | 'PROFESSIONAL' | 'FRIENDLY';
export type MusicVibeType = 'NONE' | 'ROMANTIC' | 'LOFI' | 'HYPE' | 'SAD';

export interface ChatMessage extends ChatData { audioBase64?: string; }

export interface ScheduleTask {
  id: string;
  title: string;
  category: 'WORK' | 'HEALTH' | 'LEARNING';
  timeSlot: string | null;
  priorityScore: number;
  status: 'pending' | 'completed';
  instruction?: string;
}

//  Character Interface
interface Character {
  name: string;
  url: string;
}

interface MoodState {
  // Core State
  userId: string;
  chatHistory: ChatMessage[];
  mascot: { speaking: boolean; replyText: string; action: string; expression: string; emotion: string; loading: boolean; audio_url: string | null; persona: string; winkActive: boolean };
  userProfile: UserProfile | null;
  currentMood: 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised';
  personality: PersonalityType | null;
  activeModule: string;
  musicVibe: MusicVibeType;
  isListeningMusic: boolean;
  isLightsOn: boolean; //  NEW: Room light state

  //  NEW: Vision System State
  visualVibe: string; // What Maeve sees through camera

  // Stats
  lifeStats: { energy: number; stress: number; sleep: number; happiness: number; personality: string; mood: string; vitality: string; lastUpdate: string };
  careStats: { hunger: number; hygiene: number; social: number; health: number };
  learnedFacts: string[];
  isConnected: boolean;
  schedule: ScheduleTask[];
  currentActiveTask: ScheduleTask | null;
  neuralPoints: number;

  //  Streaming States
  isStreaming: boolean;
  streamingText: string;

  //  Audio Sync State
  activeAudioElement: HTMLAudioElement | null;

  //  Physical Layout Intents
  bedState: 'NONE' | 'SLEEP' | 'SEX';
  isOnBed: boolean; // Derived helper for backward compat

  //  Settings Screen States (Persisted)
  currentMode: string;
  currentVoice: string;
  provider: string;
  volume: number;
  characters: Character[];
  activeCharacterIndex: number;
  apiKeys: { groq: string; gemini: string };

  // Spotify Neural Link States
  spotifyToken: string | null;
  isSpotifyConnected: boolean;
  isPlaying: boolean;
  bpm: number | null;
  energy: number | null;
  currentTrack: string | null;

  //  Model Swap Transition State
  isModelSwapping: boolean;
  isCinematicBlackout: boolean; //  NEW: Cinematic kiss blackout state
  cinematicKiss: {
    isActive: boolean;
    kissSfxBase64: string | null;
    audioBase64: string | null;
    kissSfxDuration: number;
    ttsDuration: number;
    sequence: any[];
  } | null;
  cycleSexualPosition: () => void;
  triggerFinishSequence: () => void;

  // Actions
  addScheduleTask: (task: ScheduleTask) => Promise<void>;
  generateSmartSchedule: () => Promise<void>;
  removeScheduleTask: (taskId: string) => Promise<void>;
  initializeListeners: () => void;
  startLocationTracking: () => void;
  sendMessage: (msg: string, responseData?: any) => Promise<void>;
  setUserProfile: (profile: UserProfile | null) => void;
  setMascotResponse: (response: { replyText?: string; mascotAction?: string; emotion?: string; audioBase64?: string; winkActive?: boolean }) => void;
  setSpeaking: (speaking: boolean) => void;
  setActiveModule: (module: any) => void;
  setAction: (action: string) => void;
  setModelSwapping: (status: boolean) => void;
  setCinematicBlackout: (active: boolean) => void; //  NEW: Set cinematic blackout state
  setVisualVibe: (vibe: string) => void; //  NEW: Vision System Action
  updateLifeStats: (stats: any) => Promise<void>;
  updateCareStats: (newStats: any) => Promise<void>;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  addLearnedFact: (fact: string) => Promise<void>;
  decayMaintenance: () => void;
  extractNeuralData: (aiResponse: string) => void;
  checkRoutineFollowUp: () => void;
  checkStressAndReplan: () => void;
  completeTaskAndReward: (taskId: string) => Promise<void>;

  //  Bed Pathfinding Actions
  setBedState: (state: 'NONE' | 'SLEEP' | 'SEX') => void;
  toggleBedState: () => void; // Quick toggle: NONE <-> SLEEP (backward compat)

  //  Settings Actions (Correctly Typed)
  setMode: (mode: string) => void;
  setVoice: (voice: string) => void;
  setProvider: (provider: string) => void;
  setVolume: (volume: number) => void;
  setActiveCharacter: (index: number) => void;
  addCharacter: (character: Character) => void;
  removeCharacter: (index: number) => void;
  setApiKey: (provider: 'groq' | 'gemini', key: string) => void;
  setLightsOn: (lightsOn: boolean) => void; //  NEW: Light control action

  //  Spotify Neural Link Actions
  loginToSpotify: () => void;
  setSpotifyToken: (token: string | null) => void;
  syncWithSpotify: () => Promise<void>;

  //  Distributed Sync Actions
  triggerSyncUplink: () => Promise<void>;
  clearCinematicKiss: () => void;
  setStreamingState: (isStreaming: boolean, text: string) => void;
  setActiveAudioElement: (audio: HTMLAudioElement | null) => void;
  voiceVolume: number;
  setVoiceVolume: (v: number) => void;
  // ─── Dynamic Performance Tier System ────────────────────────────────────
  // Tier 0 = Ultra-Low (Pentium), 1 = Low, 2 = Medium, 3 = High/Ultra
  // manualOverride = null means AUTO mode (PerformanceMonitor drives it)
  // manualOverride = 0-3 means user has LOCKED a specific tier
  performanceTier: number;       // Auto-updated by PerformanceMonitor (0-3)
  manualOverride: number | null; // null = AUTO, 0-3 = LOCKED by user
  setPerformanceTier: (tier: number) => void;
  setManualOverride: (tier: number | null) => void;
  // Legacy compat shim — reads effectiveTier internally
  isLowEnd: boolean;
  setIsLowEnd: (v: boolean) => void;
}

// Audio duplicate prevention
let lastPlayedMessageId = "";

      //  Helper to sync settings with Java Backend
      const syncWithBackend = async (userId: string, key: string, value: any) => {
        try {
          await fetch(`${API_ENDPOINTS.JAVA_CORE}/api/settings/update`, { // Global Java Backend
            method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, [key]: value })
    });
    console.log(` Synced ${key} to Backend`);
  } catch (e) {
    console.warn(` Backend Sync Failed for ${key} (Is Java running?)`);
  }
};

export const useMoodStore = create<MoodState>()(
  persist(
    (set, get) => ({
      // ------------------------------------------------
      //  INITIAL STATE
      // ------------------------------------------------
      userId: 'user_pro_01',
      chatHistory: [],
      mascot: { speaking: false, replyText: '', action: "IDLE", expression: "NEUTRAL", emotion: "NEUTRAL", loading: false, audio_url: null, persona: "DEFAULT", winkActive: false },
      userProfile: { name: "Binore", age: 20, role: "student", field: "Engineering", height: 0, weight: 0 },
      currentMood: 'neutral',
      personality: 'FRIENDLY',
      activeModule: 'dashboard',
      musicVibe: 'NONE',
      isListeningMusic: false,
      isLightsOn: true, //  NEW: Room lights start ON
      isCinematicBlackout: false, //  NEW: Start with blackout disabled

      //  NEW: Vision System State
      visualVibe: "The user is looking normally.",

      // Stats Defaults
      lifeStats: { energy: 100, stress: 50, sleep: 100, happiness: 100, personality: 'FRIENDLY', mood: 'neutral', vitality: 'high', lastUpdate: new Date().toISOString() },
      careStats: { hunger: 100, hygiene: 100, social: 100, health: 100 },
      learnedFacts: [],
      isConnected: true,
      schedule: [],
      currentActiveTask: null,
      neuralPoints: 0,

      isStreaming: false,
      streamingText: '',
      activeAudioElement: null,
      voiceVolume: 0,
      performanceTier: 3,      // Start at High — PerformanceMonitor will downgrade if needed
      manualOverride: null,     // AUTO mode by default
      isLowEnd: false,          // Legacy compat — derived from performanceTier

      bedState: 'NONE',
      isOnBed: false,

      // Settings Defaults
      currentMode: 'CALM_SUPPORTIVE',
      currentVoice: 'af_bella',
      provider: 'local',
      volume: 80,
      characters: [{ name: 'Default_Maeve', url: '/models/maevewithclothes.vrm' }],
      activeCharacterIndex: 0,
      apiKeys: { groq: '', gemini: '' },

      // Spotify Neural Link Defaults
      spotifyToken: localStorage.getItem('spotify_access_token') || null,
      isSpotifyConnected: !!localStorage.getItem('spotify_access_token'),
      isPlaying: false,
      bpm: null,
      energy: null,
      currentTrack: null,

      //  Model Swap Transition State
      isModelSwapping: false,
      cinematicKiss: null as MoodState['cinematicKiss'],

      // SETTINGS ACTIONS (The Fix for your Errors)
      // 
      setMode: async (mode) => {
        set({ currentMode: mode });
        try {
          //  Spring Boot को अपडेट भेजें
          await fetch(`${API_ENDPOINTS.JAVA_CORE}/api/settings/user_pro_01/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentMode: mode })
          });
          console.log(` Personality Matrix Switched to: ${mode}`);
        } catch (err) {
          console.error(" Sync failed", err);
        }
      },

      setVoice: (voice) => {
        set({ currentVoice: voice });
        syncWithBackend(get().userId, 'voice_model', voice);
      },

      setProvider: (provider) => {
        set({ provider });
        syncWithBackend(get().userId, 'provider', provider);
      },

      setVolume: (volume) => set({ volume }),

      setActiveCharacter: (index) => set({ activeCharacterIndex: index }),

      addCharacter: async (newChar: { name: string; url: string; file?: File }) => {
        const { characters } = get();

        // 1. Store state update karo
        set({
          characters: [...characters, newChar],
          activeCharacterIndex: characters.length
        });

        // 2. Agar asli file hai, to IndexedDB me save karo (Permanent Storage)
        if (newChar.file) {
          await saveCharacterFile(newChar.file);
          console.log(" Character File Saved to Persistent DB");
        }
      },

      //  NEW DELETE ACTION
      removeCharacter: async (index: number) => {
        const { characters, activeCharacterIndex } = get();

        // Prevent deleting the default character (Index 0)
        if (index === 0) return;

        const charToDelete = characters[index];
        const newCharacters = characters.filter((_, i) => i !== index);

        // If the deleted character was active, switch back to default
        let newActiveIndex = activeCharacterIndex;
        if (activeCharacterIndex === index) {
          newActiveIndex = 0;
        } else if (activeCharacterIndex > index) {
          newActiveIndex = activeCharacterIndex - 1;
        }

        set({
          characters: newCharacters,
          activeCharacterIndex: newActiveIndex
        });

        // If it was a custom loaded file, remove it from DB
        // (Assuming checking name or a specific flag)
        if (charToDelete.name.includes("Custom") || charToDelete.name.includes("Loaded")) {
          await deleteCharacterFile();
          console.log(" Deleted character from DB");
        }
      },

      setApiKey: (provider, key) => set((state) => ({
        apiKeys: { ...state.apiKeys, [provider]: key }
      })),

      //  Vision System Action — implemented as setVisualVibe above


      //  Spotify Neural Link Actions
      loginToSpotify: () => {
        // This will be handled by the AudioManager component
        // which imports the loginToSpotify function from utils/spotify
        console.log(' Spotify login triggered from RadialMenu');
      },

      setSpotifyToken: (token) => {
        if (token) {
          localStorage.setItem('spotify_access_token', token);
        } else {
          localStorage.removeItem('spotify_access_token');
        }
        set({
          spotifyToken: token,
          isSpotifyConnected: !!token
        });
      },

      syncWithSpotify: async () => {
        const { spotifyToken } = get();
        if (!spotifyToken) return;

        try {
          // 1. Spotify se pucho: "Kya chal raha hai?" (Safe Endpoint)
          const res = await fetch("https://api.spotify.com/v1/me/player", {
            headers: { Authorization: `Bearer ${spotifyToken}` }
          });

          //  FIX: Agar Token Expire ho gaya (401), to Logout karo
          if (res.status === 401) {
            console.warn(" Token Expired! Logging out...");
            set({
              spotifyToken: null,
              isSpotifyConnected: false,
              isPlaying: false,
              mascot: { ...get().mascot, action: 'IDLE' }
            });
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_refresh_token');
            localStorage.removeItem('spotify_token_expires_at');
            return;
          }

          // �� Case 1: Spotify app band hai ya kuch nahi baj raha (204 No Content)
          if (res.status === 204) {
            set({
              isPlaying: false,
              currentTrack: null,
              bpm: null,
              mascot: { ...get().mascot, action: 'IDLE' } // Force IDLE
            });
            return;
          }

          const data = await res.json();

          //  Case 2: User ne pause dabaya (is_playing: false)
          if (!data.is_playing) {
            set({
              isPlaying: false,
              mascot: { ...get().mascot, action: 'IDLE' } // Force IDLE
            });
            // Animation Controller ko signal milega ki isPlaying false hai
            return;
          }

          //  Case 3: Gana baj raha hai
          if (data.is_playing && data.item) {
            const songName = data.item.name;
            const artistName = data.item.artists[0].name;

            // Agar gana change nahi hua, to bar-bar API call mat karo
            if (get().currentTrack === songName) return;

            console.log(` Detected: ${songName} by ${artistName}`);

            // 2.  Last.fm (Backend) se Mood/BPM pucho (403 Bypass)
            const moodRes = await fetch(`${API_ENDPOINTS.JAVA_CORE}/api/spotify/get-mood-external`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ song_name: songName, artist: artistName })
            });

            const moodData = await moodRes.json();
            const tags = moodData.track?.toptags?.tag || [];

            //  NEW: Backend se "Brain Decision" lo
            const backendDance = moodData.neural_dance;

            // 3.  Smart Tag Analysis (Mood -> BPM)
            let estimatedBpm = 110; // Default
            let energy = 0.5;
            let action = "DANCE_HAPPY";

            // Tags check karo - better way
            const tagNames = tags.map((t: any) => t.name?.toLowerCase() || '').join(' ');

            if (tagNames.includes('metal') || tagNames.includes('rock') || tagNames.includes('fast')) {
              estimatedBpm = 140; energy = 0.9; action = "DANCE_COOL";
            } else if (tagNames.includes('club') || tagNames.includes('dance') || tagNames.includes('pop')) {
              estimatedBpm = 128; energy = 0.8; action = "DANCE_HAPPY";
            } else if (tagNames.includes('chill') || tagNames.includes('jazz') || tagNames.includes('slow')) {
              estimatedBpm = 85; energy = 0.3; action = "DANCE_SEXY"; // Slow dance
            }

            // Agar Backend ne dance diya hai to wahi use karo, warna tag analysis ka
            const finalDance = backendDance || action;

            // 4. Update State & Animation
            set({
              isPlaying: true,
              currentTrack: songName,
              bpm: estimatedBpm,
              energy: energy,
              mascot: { ...get().mascot, action: finalDance }
            });

            // Controller ko force update karo
            if ((window as any).characterManager) {
              (window as any).characterManager.play(finalDance);
            }

            //  Animation Speed Sync - REMOVED: Each controller handles its own speed
            // if ((window as any).motionController) {
            //     const finalSpeed = estimatedBpm / 115; // 115 is base speed of animation
            //     (window as any).motionController.setGlobalSpeed(finalSpeed);
            //     console.log(` Maeve Dancing: ${finalDance} @ ${finalSpeed.toFixed(2)}x Speed`);
            // }
          }
        } catch (err) {
          // Silent fail (console flood mat karo)
        }
      },

      // ------------------------------------------------
      // CORE ACTIONS (Existing Logic)
      // ------------------------------------------------
      setUserProfile: (profile) => set({ userProfile: profile }),
      setActiveModule: (activeModule) => set({ activeModule }),
      setSpeaking: (speaking) => set((state) => ({ mascot: { ...state.mascot, speaking } })),
      setAction: (action) => {
        // Just set the action requested by the controller or backend.
        set((state) => ({
          mascot: { ...state.mascot, action: action }
        }));
        
        // Also ensure the 3D model immediately plays the action if CharacterManager is available
        const controller = (window as any).characterManager;
        if (controller && controller.play) {
          controller.play(action);
        }
      },
      setActiveAudioElement: (audio) => set({ activeAudioElement: audio }),
      setVoiceVolume: (v) => set({ voiceVolume: v }),
      setPerformanceTier: (tier) => set((state) => ({
        performanceTier: tier,
        // Keep isLowEnd in sync for all legacy consumers (VibeLibrary, CinematicPostProcessing, etc.)
        isLowEnd: state.manualOverride === null ? tier <= 1 : state.manualOverride <= 1,
      })),
      setManualOverride: (override) => set((state) => ({
        manualOverride: override,
        isLowEnd: override === null
          ? state.performanceTier <= 1
          : override <= 1,
      })),
      // Legacy compat shim — maps boolean onto the tier system
      setIsLowEnd: (v) => set((state) => ({
        isLowEnd: v,
        performanceTier: v ? Math.min(state.performanceTier, 1) : Math.max(state.performanceTier, 2),
      })),

      //  Bed State Machine
      setBedState: (newState) => {
        set({ bedState: newState, isOnBed: newState !== 'NONE' });
        const cm = (window as any).characterManager;
        if (newState === 'SLEEP') {
          cm?.play('LAYING');
        } else if (newState === 'SEX') {
          cm?.play('IDLE'); // Replace with your SEX anim key when ready
        } else {
          cm?.play('IDLE');
        }
      },

      // Quick toggle NONE <-> SLEEP (keeps old button working)
      toggleBedState: () => {
        const s = get().bedState;
        const next = s === 'NONE' ? 'SLEEP' : 'NONE';
        get().setBedState(next);
      },

      //  Change Position Button (Sirf Backshots ke liye)
      cycleSexualPosition: () => {
        const { mascot } = get();
        const currentAction = mascot.action;

        if (currentAction.startsWith('BACKSHOT')) {
          const positions = ['BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4'];
          const idx = positions.indexOf(currentAction);
          const nextAction = positions[(idx + 1) % positions.length];

          set({ mascot: { ...mascot, action: nextAction } });
          (window as any).characterManager?.play(nextAction);
        }
      },

      //  Finish Button (Sirf Blowjob 3 trigger karne ke liye)
      triggerFinishSequence: () => {
        const { mascot } = get();
        // Sirf tab trigger hoga jab Blowjob 2 (loop) chal raha ho
        if (mascot.action === 'BLOWJOB2') {
          set({ mascot: { ...mascot, action: 'BLOWJOB3' } });
          (window as any).characterManager?.play('BLOWJOB3');
        }
      },

      setModelSwapping: (status) => set({ isModelSwapping: status }),
      setCinematicBlackout: (active) => set({ isCinematicBlackout: active }), //  NEW: Set cinematic blackout

      setLightsOn: (lightsOn) => {
        set({ isLightsOn: lightsOn });
        syncWithBackend(get().userId, 'room_lights', lightsOn);
      },
      setVisualVibe: (vibe: string) => {
        set({ visualVibe: vibe });
      }, //  NEW: Vision System Action

      setMascotResponse: (response) => {
        let audioBlobUrl = null;
        if (response.audioBase64) {
          try {
            const byteCharacters = atob(response.audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            audioBlobUrl = URL.createObjectURL(new Blob([byteArray], { type: 'audio/wav' }));
          } catch (e) {
            console.error("Failed to convert audioBase64 to blob URL", e);
          }
        }

        set((state) => {
          if (state.mascot.audio_url && audioBlobUrl !== undefined) {
            URL.revokeObjectURL(state.mascot.audio_url);
          }

          //  Clean up previous TTS audio gracefully
          const oldAudio = state.activeAudioElement;
          if (oldAudio) {
            oldAudio.pause();
            oldAudio.src = "";
          }

          //  Mount new HTMLAudioElement directly (if not cinematic kiss)
          let newAudio: HTMLAudioElement | null = null;
          if (audioBlobUrl && !(response as any).isCinematicKiss) {
            newAudio = new Audio(audioBlobUrl);
            newAudio.crossOrigin = "anonymous";
            newAudio.play().catch(e => console.error("Audio play error:", e));
            newAudio.onended = () => {
              // Update state when audio ends to close mouth and reset flag
              set({ activeAudioElement: null });
              set((s) => ({ mascot: { ...s.mascot, speaking: false } }));
            };
          }

          const newState = {
            currentMood: (response.emotion?.toLowerCase() as any) || 'neutral',
            mascot: {
              ...state.mascot,
              replyText: response.replyText || "",
              action: response.mascotAction || "IDLE",
              emotion: response.emotion || "NEUTRAL",
              persona: (response as any).persona || state.mascot.persona || "DEFAULT",
              speaking: !!newAudio,
              audio_url: audioBlobUrl,
              winkActive: response.winkActive !== undefined ? response.winkActive : state.mascot.winkActive
            },
            activeAudioElement: newAudio || state.activeAudioElement
          };

          //  Trigger 3D Actions
          const controller = (window as any).characterManager;
          if (controller) {
            if (response.mascotAction) controller.play(response.mascotAction);

            //  NEW: Cinematic Kiss Handling - Let CharacterManager handle these SFX/TTS
            if ((response as any).isCinematicKiss) {
              console.log(" CINEMATIC KISS DETECTED in setMascotResponse");
              set({
                cinematicKiss: {
                  isActive: true,
                  kissSfxBase64: (response as any).kissSfxBase64 || null,
                  audioBase64: (response as any).audioBase64 || null,
                  kissSfxDuration: (response as any).kissSfxDuration || 2.5,
                  ttsDuration: (response as any).duration || 3.0,
                  sequence: (response as any).cinematicSequence || []
                }
              });
              // Note: If cinematic kiss, we still dispatch it to the CharacterManager
              controller.handleServerResponse(response);
            }

            //  We no longer pass audioBase64 for regular speech to the controller.
            // But we still pass emotion so the controller updates facial rig if needed.
            if (!(response as any).isCinematicKiss && response.emotion) {
              controller.handleServerResponse({ emotion: response.emotion, mascotAction: response.mascotAction });
            }
          }
          return newState;
        });
      },

      clearCinematicKiss: () => set({ cinematicKiss: null }),

      addScheduleTask: async (task) => {
        const { userId, schedule } = get();
        const updated = [...schedule, task];
        set({ schedule: updated });
        await firebaseService.saveSchedule(userId, updated);
      },

      removeScheduleTask: async (taskId) => {
        const { userId, schedule } = get();
        const updated = schedule.filter(t => t.id !== taskId);
        set({ schedule: updated });
        await firebaseService.saveSchedule(userId, updated);
      },

      generateSmartSchedule: async () => {
        const { userId, schedule, lifeStats, userProfile, setMascotResponse } = get();

        const tasksToSend = schedule.length > 0
          ? schedule.map(t => t.title).join(", ")
          : "Create a balanced daily routine for a student";

        try {
          // We hit Python backend exactly as before
          const response = await fetch(`${API_ENDPOINTS.BRAIN}/api/schedule/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tasks: tasksToSend,
              energy: lifeStats.energy,
              userId: userId,
              user_details: userProfile || { name: 'User' }
            })
          });

          const data = await response.json();

          if (data.status === 'success' && Array.isArray(data.schedule)) {
            // Force state update with newly generated array
            set({ schedule: data.schedule });

            // Maeve speaks summary
            setMascotResponse({
              replyText: data.summary || "I've optimized your neural timeline, Sir.",
              mascotAction: "THINKING",
              emotion: "HAPPY"
            });

            // ALSO save to Firebase if you want it synced immediately
            await firebaseService.saveSchedule(userId, data.schedule);
          } else {
            throw new Error("Invalid schedule format received.");
          }
        } catch (e) {
          console.error("Neural Planning Failed", e);
          setMascotResponse({
            replyText: "Neural Uplink Offline. Please check backend connection.",
            mascotAction: "SAD",
            emotion: "SAD"
          });
        }
      },

      updateLifeStats: async (stats) => {
        const { userId } = get();
        set({ lifeStats: stats });
        await firebaseService.saveLifeStats(userId, stats);
      },

      updateCareStats: async (newStats) => {
        const { userId } = get();
        set({ careStats: newStats });
        await firebaseService.saveCareStats(userId, newStats);
      },

      updateUserProfile: async (profile) => {
        const { userId } = get();
        set({ userProfile: profile });
        await firebaseService.saveUserProfile(userId, profile);
      },

      addLearnedFact: async (fact) => {
        const { userId, learnedFacts } = get();
        const updated = [...learnedFacts, fact].slice(-10);
        set({ learnedFacts: updated });
        await firebaseService.saveLearnedFacts(userId, updated);
      },

      decayMaintenance: () => {
        const { careStats } = get();
        const newStats = {
          ...careStats,
          hunger: Math.max(0, careStats.hunger - 2),
          hygiene: Math.max(0, careStats.hygiene - 1)
        };
        set({ careStats: newStats });
      },

      extractNeuralData: (aiResponse) => {
        const factKeywords = ["remember", "learned", "told me"];
        if (factKeywords.some(k => aiResponse.toLowerCase().includes(k))) {
          const fact = aiResponse.replace(/<<.*?>>/g, '').split('.')[0];
          get().addLearnedFact(fact);
        }
      },

      checkRoutineFollowUp: async () => {
        const { schedule, setMascotResponse, currentMode } = get();

        const now = new Date();
        const hours24 = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const currentTime24 = `${hours24}:${minutes}`;

        const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        const hours12 = (now.getHours() % 12 || 12).toString().padStart(2, '0');
        const currentTime12 = `${hours12}:${minutes} ${ampm}`;

        const activeTask = schedule.find(t =>
          t.status === 'pending' &&
          (t.timeSlot === currentTime24 || t.timeSlot === currentTime12)
        );

        if (activeTask) {
          console.log(` Reminder Triggered: ${activeTask.title}`);
          set({ currentActiveTask: activeTask });

          const isStrict = currentMode === "MEAN_GIRLFRIEND" || currentMode === "PREMIUM";
          const reminderText = isStrict
            ? `Hey! It's ${activeTask.timeSlot}. Stop wasting time and start your mission: ${activeTask.title}. Right now!`
            : `Darling, it's ${activeTask.timeSlot}. Time for our mission: "${activeTask.title}". Let's get to work!`;

          //  NEW: Mapped exactly to your Python VOICE_PROFILES
          const voiceStyle = isStrict ? "ANGRY" : "HAPPY";

          try {
            //  Call the new Port 5003 Edge TTS Server
            const ttsRes = await fetch(`${API_ENDPOINTS.TTS}/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: reminderText,
                style: voiceStyle // Changed 'mood' to 'style' matching python
              })
            });

            const ttsData = await ttsRes.json();

            //  Maeve ko screen par bulwao with Audio!
            setMascotResponse({
              replyText: reminderText,
              mascotAction: "THINKING",
              emotion: voiceStyle,
              audioBase64: ttsData.status === "success" ? ttsData.audio_base64 : null //  Play Audio instantly
            });

          } catch (e) {
            console.error(" Edge TTS Failed, falling back to silent text", e);
            setMascotResponse({
              replyText: reminderText,
              mascotAction: "WAVE",
              emotion: "HAPPY"
            });
          }
        }
      },

      checkStressAndReplan: async () => {
        const { lifeStats, generateSmartSchedule, setMascotResponse } = get();
        if (lifeStats.stress > 70) {
          setMascotResponse({
            replyText: ` Situation has changed, Darling. Your stress level is ${lifeStats.stress}%. I've updated our priorities.`,
            mascotAction: "THINKING",
            emotion: "CONCERNED"
          });
          await generateSmartSchedule();
        }
      },

      //  MISSION REWARD SYSTEM
      completeTaskAndReward: async (taskId) => {
        const { userId, schedule, neuralPoints, setMascotResponse } = get();

        const taskIndex = schedule.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const task = schedule[taskIndex];
        const updatedSchedule = [...schedule];
        updatedSchedule[taskIndex] = { ...task, status: 'completed' };

        const baseReward = 10;
        const priorityBonus = task.priorityScore * 2;
        const totalReward = baseReward + priorityBonus;

        set({
          schedule: updatedSchedule,
          currentActiveTask: null,
          neuralPoints: neuralPoints + totalReward
        });

        setMascotResponse({
          replyText: ` Mission Accomplished! You earned ${totalReward} Neural Points! Total: ${neuralPoints + totalReward} `,
          mascotAction: "DANCE",
          emotion: "HAPPY"
        });

        await firebaseService.saveSchedule(userId, updatedSchedule);
        await firebaseService.saveNeuralPoints(userId, neuralPoints + totalReward);
      },

      initializeListeners: async () => {
        const { userId } = get();

        console.log(" Initializing Systems and fetching saved data...");

        // --- 1.  THE FIX: FETCH SAVED DATA ON LOAD  ---
        try {
          // Fetch Chat History
          const historyRes = await axios.get(`${API_ENDPOINTS.BRAIN}/api/sync/history?userId=${userId}`, { timeout: 10000 });
          if (historyRes.status === 200) {
            const historyData = historyRes.data;
            if (historyData && historyData.length > 0) {
              set({ chatHistory: historyData });
              console.log(" Chat History Restored:", historyData.length, "messages");
            }
          }

          // Fetch Profile and Settings
          const profileRes = await axios.get(`${API_ENDPOINTS.BRAIN}/api/sync/profile?userId=${userId}`, { timeout: 10000 });
          if (profileRes.status === 200) {
            const profileData = profileRes.data;
            if (profileData && profileData.settings) {
              set({
                currentMode: profileData.settings.currentMode || 'DEFAULT',
                provider: profileData.settings.provider || 'local',
                // ... set other saved settings ...
              });
            }
          }

          // Note: If you are saving schedule in Python profile settings, fetch it here too.
          // Otherwise, rely on your Firebase listener below to hydrate it.

        } catch (e) {
          console.error(" Could not load initial data from local server.", e);
        }

        // --- 2. RELOAD FIX: Check DB for saved character ---
        try {
          const savedBlob = await getCharacterFile();
          if (savedBlob) {
            console.log(" Restoring Custom Character from DB...");
            const restoredUrl = URL.createObjectURL(savedBlob);

            set((state) => ({
              characters: [
                ...state.characters,
                { name: 'Custom_Loaded', url: restoredUrl }
              ],
              activeCharacterIndex: state.characters.length // Select the loaded one
            }));
          }
        } catch (e) {
          console.warn("No saved character found in DB");
        }

        // --- 3. Start GPS Tracking ---
        get().startLocationTracking();

        // --- 4. Existing Firebase Listeners ---
        console.log(" Listening for actions on user:", userId);

        firebaseService.listenForChat(userId, (messages) => {
          if (!messages || messages.length === 0) return;

          const currentHistory = get().chatHistory;

          const sortedMessages = messages.map(msg => {
            let timeNum = typeof msg.timestamp === 'number' ? msg.timestamp : new Date(msg.timestamp).getTime();
            if (isNaN(timeNum)) timeNum = Date.now();
            return { ...msg, timestamp: timeNum };
          });

          //  FIXED: Merge logic instead of total overwrite
          // Combined array, filtered for duplicates by ID
          const combined = [...currentHistory, ...sortedMessages];
          const uniqueMap = new Map();
          combined.forEach(m => {
            if (m.id) uniqueMap.set(m.id, m);
            else uniqueMap.set(`${m.sender}-${m.timestamp}`, m);
          });

          const finalHistory = Array.from(uniqueMap.values())
            .sort((a, b) => a.timestamp - b.timestamp);

          set({ chatHistory: finalHistory });

          const lastMsg = finalHistory[finalHistory.length - 1];
          const isFresh = (Date.now() - lastMsg.timestamp) < 10000;

          if (lastMsg.sender === 'maeve' && lastMsg.id !== lastPlayedMessageId && isFresh) {
            lastPlayedMessageId = lastMsg.id || "";
            const controller = (window as any).characterManager;

            if (controller) {
              const text = lastMsg.message || "";
              const actionMatch = text.match(/<<([A-Z_]+)>>/);
              const action = actionMatch ? actionMatch[1] : "IDLE";

              console.log(" Playing Animation:", action);

              //  CRITICAL FIX IS HERE 
              // Call setMascotResponse to trigger emotion and overlay properly
              get().setMascotResponse({
                replyText: text,
                mascotAction: action,
                emotion: action.includes('ANGRY') ? 'angry' : 'neutral'
              });

              // फिर एनीमेशन प्ले करो
              controller.play(action);

              if (lastMsg.audioBase64) {
                console.log(" Playing Audio via handleServerResponse...");
                // Use handleServerResponse for proper SFX/TTS handling
                controller.handleServerResponse(lastMsg);
              }
            }
          }
        });

        firebaseService.listenForLifeStats(userId, (s) => set({ lifeStats: { ...get().lifeStats, ...s } }));
        firebaseService.listenForCareStats(userId, (s) => set({ careStats: { ...get().careStats, ...s } }));
        firebaseService.listenForUserProfile(userId, (p) => set({ userProfile: p ? { ...get().userProfile, ...p } : get().userProfile }));
        firebaseService.listenForSchedule(userId, (sc) => {
          if (sc && sc.length > 0) {
            set({ schedule: sc });
          }
        });
        firebaseService.listenForNeuralPoints(userId, (np) => set({ neuralPoints: np || 0 }));

        // --- 5. TIMERS ---
        // --- 3. SPOTIFY NEURAL LINK - Auto Sync Every 5 Seconds ---
        const spotifySyncInterval = setInterval(() => {
          get().syncWithSpotify();
        }, 5000);

        //  GHOST SYNC TRIGGER
        // Properly throttled PC check loop with timeout chaining
        let isStoreActive = true;
        let isSyncing = false;
        let syncTimeout: ReturnType<typeof setTimeout>;

        const checkAndSync = async () => {
          if (!isStoreActive) return;

          if (!isSyncing) {
            const pcOnline = await maeveAPI.isPcOnline();
            if (pcOnline && isStoreActive) {
              isSyncing = true;
              console.log(" PC Online! Triggering ghost sync...");
              get().triggerSyncUplink();

              // 5 second cooldown
              setTimeout(() => { isSyncing = false; }, 5000);
            }
          }

          if (isStoreActive) {
            syncTimeout = setTimeout(checkAndSync, 10000);
          }
        };

        syncTimeout = setTimeout(checkAndSync, 10000);

        //   NEW: THE NAGGING GIRLFRIEND LOOP  
        // Har 1 minute (60000ms) mein ghadi check karegi
        const routineInterval = setInterval(() => {
          get().checkRoutineFollowUp();
        }, 60000);

        // Cleanup on unmount
        return () => {
          isStoreActive = false;
          clearInterval(spotifySyncInterval);
          clearTimeout(syncTimeout);
          clearInterval(routineInterval); // <--- Isey add karna mat bhulna
        };
      },

      // ---  REAL-TIME LOCATION & CONTEXT TRACKER ---
      startLocationTracking: () => {
        if ("geolocation" in navigator) {
          console.log(" Maeve GPS Tracking Activated...");

          navigator.geolocation.watchPosition(async (position) => {
            // Speed is in meters per second. 3 m/s is roughly 10 km/h.
            const speed = position.coords.speed;
            let currentStatus = "Stationary / At Home";

            // If speed is greater than 3 m/s, you are likely in a vehicle
            if (speed !== null && speed > 3) {
              currentStatus = "Traveling / Commuting";
            }

            console.log(` Maeve detected movement: ${currentStatus}`);

            // Send this context silently to Python Brain
            try {
              await axios.post(`${API_ENDPOINTS.BRAIN}/api/location/sync`, {
                userId: get().userId,
                status: currentStatus
              }, { timeout: 10000 });
            } catch (e) {
              // Silent fail if backend is down
            }
          },
            (error) => console.error("GPS Error:", error),
            { enableHighAccuracy: true, maximumAge: 10000 }
          );
        } else {
          console.log(" Geolocation is not supported by this browser.");
        }
      },

      sendMessage: async (message: string, responseData?: any) => {
        const { chatHistory, mascot } = get();

        // 1. Add User Message to UI immediately if it's a new message
        if (message) {
          const timestampNum = Date.now();
          const newMsg: ChatMessage = {
            id: `temp-${timestampNum}`,
            message: message,
            sender: 'user',
            timestamp: timestampNum
          };

          const intenseActions = ['MASTURBATE', 'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4', 'BLOWJOB', 'BLOWJOB2', 'BLOWJOB3', 'AHEGAO', 'SEXY', 'LOVE', 'KISS'];
          const isCurrentlyNude = intenseActions.includes(mascot.action);

          set({
            chatHistory: [...chatHistory, newMsg],
            mascot: {
              ...mascot,
              action: isCurrentlyNude ? mascot.action : "THINKING",
              speaking: true,
              loading: true
            }
          });
        }

        // 2. If legacy response data is provided, update UI immediately
        if (responseData) {
          const replyTimestamp = Date.now() + 1;
          const replyMsg: ChatMessage = {
            id: `reply-${replyTimestamp}`,
            message: responseData.replyText || "...",
            sender: 'maeve',
            timestamp: replyTimestamp,
            audioBase64: responseData.audioBase64
          };

          set((state) => ({
            chatHistory: [...state.chatHistory, replyMsg],
            mascot: {
              ...state.mascot,
              replyText: responseData.replyText || "",
              emotion: responseData.emotion || "NEUTRAL",
              action: responseData.mascotAction || responseData.animation || "IDLE",
              speaking: true,
              loading: false
            }
          }));

          //  Trigger 3D Response for legacy results
          if ((window as any).characterManager) {
            (window as any).characterManager.handleServerResponse(responseData);
          }
          return;
        }

        // 3. Streaming is handled by useMaeveStream hook in the component
        console.log(" SocketIO Streaming mode active. Processing delegated to hook.");
      },

      setStreamingState: (isStreaming, text) => set({ isStreaming, streamingText: text }),

      //  Naya Sync Action add karo useMoodStore mein:
      triggerSyncUplink: async () => {
        const { userId } = get();
        const unsynced = JSON.parse(localStorage.getItem('unsynced_history') || '[]');

        if (unsynced.length === 0) return;

        const pcOnline = await maeveAPI.isPcOnline();
        if (pcOnline) {
          console.log(" PC detected! Syncing cloud messages to local drive...");
          try {
            const res = await axios.post(`${API_ENDPOINTS.BRAIN}/api/sync/uplink`, {
              userId, messages: unsynced
            }, { timeout: 10000 });

            if (res.status === 200) {
              localStorage.removeItem('unsynced_history'); // Clear queue after success
              console.log(" All messages synced to PC.");
            }
          } catch (e) {
            console.error(" Uplink failed, will retry later.");
          }
        }
      },
    }),
    {
      name: 'maeve-neural-storage', //  LocalStorage Key
      storage: createJSONStorage(() => localStorage),

      //  IMPORTANT FIX HERE 
      // हम 'characters' और 'activeCharacterIndex' को सेव होने से रोक रहे हैं
      // क्योंकि Blob URLs रिफ्रेश होने पर क्रैश करते हैं।
      partialize: (state) => ({
        chatHistory: state.chatHistory, //  Added for persistence
        currentMode: state.currentMode,
        currentVoice: state.currentVoice,
        provider: state.provider,
        volume: state.volume,
        apiKeys: state.apiKeys,

        //  Ye add karo taaki reload ke baad task na ude
        schedule: state.schedule,
        neuralPoints: state.neuralPoints,
        lifeStats: state.lifeStats,
        userProfile: state.userProfile
      }),
    }
  )
);