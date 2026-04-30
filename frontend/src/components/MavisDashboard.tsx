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

// Screens
import { SettingsScreen } from './SettingsScreen';
import { MascotCareScreen } from './MascotCareScreen';
import { MascotWellnessScreen } from './MascotWellnessScreen';
import { MascotDeviceScreen } from './MascotDeviceScreen';
import { MascotScheduleScreen } from './MascotScheduleScreen';




export const MavisDashboard: React.FC = () => {
  const { width } = useScreenSize();

  //  Breakpoint set to 1024px to cover tablets/small laptops
  const isMobile = width < 1024;

  // State
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false); // Mobile Chat Toggle State

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { mascot, setAction, sendMessage, initializeListeners, isOnBed, setBedState, bedState, setMascotResponse } = useMoodStore();

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

  const handleSexCycle = () => {
    const positions = [
      'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4', 'BACKSHOT5',
      'FRONT', 'FRONT2'
    ];
    const currentIndex = positions.indexOf(mascot.action);
    const nextPos = positions[(currentIndex + 1) % positions.length];
    setAction(nextPos);
  };

  if (activeScreen === 'settings') return <SettingsScreen onBack={() => setActiveScreen(null)} />;

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



      {/*  BUTTON: Interaction Outro Trigger */}
      {(mascot.action.includes('BLOWJOB') || mascot.action.includes('BACKSHOT') || mascot.action.includes('FRONT')) && (
        <button
          onClick={() => {
            if ((window as any).characterManager) {
              (window as any).characterManager.endInteraction();
            } else {
              setAction("BLOWJOB3");
            }
          }}
          className="absolute bottom-36 right-10 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold rounded-full shadow-[0_0_20px_rgba(255,0,0,0.4)] animate-pulse z-50"
        >
          {mascot.action.includes('BLOWJOB') ? ' Trigger BLOWJOB3C' : ' Cum / Finish'}
        </button>
      )}

      {/*  Separate Cycle Buttons for Oral and Sex */}
      {isOnBed && (
        <div style={{ position: 'absolute', top: '15%', right: '20px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 1000 }}>
          {/* TEST BLOWJOB BUTTON */}
          <button
            onClick={() => {
              if ((window as any).characterManager) {
                (window as any).characterManager.playInteractionSequence("BLOWJOB");
              }
            }}
            style={{
              padding: '12px 24px',
              background: 'rgba(168, 85, 247, 0.9)', // Brighter Purple
              color: 'white',
              borderRadius: '50px',
              border: '2px solid #a855f7',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 0 15px rgba(168, 85, 247, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
             Test Blowjob
          </button>

          {/* SEX BUTTON */}
          <button
            onClick={handleSexCycle}
            style={{
              padding: '12px 24px',
              background: 'rgba(239, 68, 68, 0.9)', // Red
              color: 'white',
              borderRadius: '50px',
              border: '2px solid #ef4444',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
             Sex (Pos)
          </button>
        </div>
      )}







      {bedState === 'SEX' && (
        <button
          onClick={() => {
            const newState = bedState === 'SEX' ? 'SLEEP' : 'SEX';
            setBedState(newState);
            //  Force animation update so "Cycle" button shows up immediately
            if (newState === 'SEX') setAction('BACKSHOT');
          }}
          style={{
            position: 'absolute',
            bottom: '240px',
            right: '20px',
            padding: '12px 24px',
            background: bedState === 'SEX' ? 'rgba(200,0,0,0.85)' : 'rgba(120,0,60,0.85)',
            color: 'white',
            borderRadius: '50px',
            border: `2px solid ${bedState === 'SEX' ? '#ff2020' : '#ff4caf'}`,
            cursor: 'pointer',
            zIndex: 1000,
            fontWeight: 'bold',
            boxShadow: `0 0 18px ${bedState === 'SEX' ? 'rgba(255,30,30,0.6)' : 'rgba(255,76,175,0.4)'}`,
            transition: 'all 0.3s ease'
          }}
        >
          {bedState === 'SEX' ? ' Back to Sleep' : ' Sex Position'}
        </button>
      )}

      {/*  LAYER 2: HUD Screens Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <AnimatePresence mode="wait">
          {activeScreen === 'system' && <MascotDeviceScreen key="system" onBack={() => setActiveScreen(null)} />}
          {activeScreen === 'care' && <MascotCareScreen key="care" onBack={() => setActiveScreen(null)} />}
          {activeScreen === 'wellness' && <MascotWellnessScreen key="wellness" onBack={() => setActiveScreen(null)} />}
          {activeScreen === 'schedule' && <MascotScheduleScreen key="schedule" onBack={() => setActiveScreen(null)} />}

        </AnimatePresence>
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