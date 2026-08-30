import React, { Suspense, useState, useEffect } from 'react';

import { useMoodStore } from '../stores/moodStore';
import { VRMCharacter } from './VRMCharacter';
import { useVibeContext } from '../vibe/GameVibeProvider';
import RadialMenu from './RadialMenu';

import { motion, AnimatePresence } from 'framer-motion';
import { useScreenSize } from '../hooks/useScreenSize';
import { StarryBackground } from './StarryBackground';


// Components
import ExpandableChatInput from './ExpandableChatInput';
import { AssistantSpeechDisplay } from './AssistantSpeechDisplay'; // Ensure this component handles the message list

// Screens (Lazy Loaded)
import { lazy } from 'react';
const SettingsScreen = lazy(() => import('./SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const MascotCareScreen = lazy(() => import('./MascotCareScreen').then(m => ({ default: m.MascotCareScreen })));
const MascotWellnessScreen = lazy(() => import('./MascotWellnessScreen').then(m => ({ default: m.MascotWellnessScreen })));
const MascotDeviceScreen = lazy(() => import('./MascotDeviceScreen').then(m => ({ default: m.MascotDeviceScreen })));
const MascotScheduleScreen = lazy(() => import('./MascotScheduleScreen').then(m => ({ default: m.MascotScheduleScreen })));




export const MavisDashboard: React.FC = () => {
  const { width } = useScreenSize();

  //  Breakpoint set to 1024px to cover tablets/small laptops
  const isMobile = width < 1024;

  // State
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false); // Mobile Chat Toggle State

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { mascot, setAction, sendMessage, initializeListeners, isOnBed, setBedState, bedState, setMascotResponse, isConnected } = useMoodStore();

  const { getFilterStyle } = useVibeContext();



  useEffect(() => {
    initializeListeners();
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMobile) {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x, y });
    }
  };

  const handleSend = async (msg: string) => {
    await sendMessage(msg);
  };

  //  Specialized Cycling Logic

  
  if (activeScreen === 'settings') return <Suspense fallback={<div className="text-white flex justify-center items-center h-screen">Loading Settings...</div>}><SettingsScreen onBack={() => setActiveScreen(null)} /></Suspense>;

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden font-sans text-white bg-black perspective-1000"
      onMouseMove={handleMouseMove}
      style={getFilterStyle()}
    >
      <StarryBackground mousePos={mousePos} />

      {/*  LAYER 1: 3D Character */}
      {/* Logic: If on Mobile AND Chat is Open -> HIDE Character. Otherwise SHOW. */}
      <div
        className={`absolute inset-0 z-0 flex items-center justify-center transition-all duration-500 ${isMobile && isChatOpen
          ? 'opacity-0 scale-95 blur-sm pointer-events-none' // Hidden
          : 'opacity-100 scale-100 blur-0 pointer-events-auto' // Visible
          }`}
      >
        <Suspense fallback={null}>
          <VRMCharacter />

        </Suspense>
      </div>



      
      {/* GLOBAL CONNECTION OVERLAY */}
      {!isConnected && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-600/90 text-white px-4 py-2 rounded-full font-bold text-sm shadow-[0_0_15px_rgba(255,0,0,0.5)] backdrop-blur-md flex items-center gap-2 animate-pulse pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          Backend Offline - Reconnecting...
        </div>
      )}

      {/*  LAYER 2: HUD Screens Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Suspense fallback={null}>
          <AnimatePresence mode="wait">
            {activeScreen === 'system' && <MascotDeviceScreen key="system" onBack={() => setActiveScreen(null)} />}
            {activeScreen === 'care' && <MascotCareScreen key="care" onBack={() => setActiveScreen(null)} />}
            {activeScreen === 'wellness' && <MascotWellnessScreen key="wellness" onBack={() => setActiveScreen(null)} />}
            {activeScreen === 'schedule' && <MascotScheduleScreen key="schedule" onBack={() => setActiveScreen(null)} />}
          </AnimatePresence>
        </Suspense>
      </div>

      {/* ================= MAIN INTERFACE ================= */}
      <AnimatePresence>
        {!activeScreen && (
          <>
            {/*  MUSIC VISUALIZER OVERLAY */}
            {/* <MusicVisualizer /> */}

            {/* LAYER 3: Chat History Panel */}
            {/* Logic: 
                    Desktop: Always Visible
                    Mobile: Only Visible if isChatOpen is TRUE
                */}
            <div className={`absolute inset-0 z-20 pointer-events-none transition-all duration-300 ${!isMobile || isChatOpen
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-10'
              }`}>
              <AssistantSpeechDisplay
                isMobileOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
              />
            </div>

            {/* LAYER 4: PREMIUM DOCK (Always Visible) */}
            <div className="absolute bottom-4 left-0 w-full z-50 pointer-events-none flex justify-center">
              <ExpandableChatInput
                onSendMessage={handleSend}
                radialMenuComponent={<RadialMenu onNavigate={setActiveScreen} />}

                // Mobile Toggle Logic
                onChatToggle={() => setIsChatOpen(!isChatOpen)}
                isChatOpen={isChatOpen}
                isMobile={isMobile}
              />
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};