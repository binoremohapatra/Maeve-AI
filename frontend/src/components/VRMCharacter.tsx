import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneContent } from './VRMScene'; // SceneContent yahan se aa raha hai
import { CharacterManager } from '../controllers/CharacterManager';
import { KissOverlay } from './KissOverlay';
import { useMoodStore } from '../stores/moodStore';
import { GameVibeR3F } from '../vibe/GameVibeProvider';
import { PsychologicalOverlay } from './vibe/PsychologicalOverlay';
import { usePoltergeistUI } from '../hooks/usePoltergeistUI';

//  Psychological Screen-Space Overlay
//  The Ultimate Psychological Screen-Space Overlay
export const CinematicAtmosphere = () => {
  //  FIX: Atomic selectors to prevent render cascade when mascot.speaking or audio_url changes
  const mascotEmotion = useMoodStore(state => state.mascot?.emotion);
  const mascotAction = useMoodStore(state => state.mascot?.action);

  //  SMART FALLBACK: Agar 'emotion' explicitly set nahi hai, toh 'action' se vibe uthao
  // Kyunki 'BACKSHOT' ya 'TYPING' jaise actions ka apna atmosphere hota hai.
  const emotionKey = (mascotEmotion || mascotAction || 'NEUTRAL').toUpperCase();

  let boxShadow = 'inset 0 0 0px rgba(0,0,0,0)'; // Transparent default

  // 1.  INTIMATE / LUST / NSFW VIBE (Dreamy Magenta / Hot Pink)
  if ([
    'LUST', 'SEXY', 'PLEASURE', 'SATISFACTION', 'ROMANCE', 'KISS', 'NORMALKISS',
    'HUGGINGKISS', 'BLOWKISS', 'LOVE', 'MASTURBATE', 'AHEGAO', 'ECSTASY',
    'SEXUAL_DESIRE', 'CRAVING', 'BACKSHOT', 'BACKSHOT2', 'BACKSHOT3', 'BACKSHOT4',
    'BACKSHOT5', 'BLOWJOB', 'BLOWJOB1', 'BLOWJOB2', 'BLOWJOB3', 'FRONT', 'FRONT2', 'FRONTSLOW'
  ].includes(emotionKey)) {
    boxShadow = 'inset 0 0 180px rgba(255, 20, 147, 0.25)';
  }

  // 2.  DANGER / AGGRESSION VIBE (Intense Crimson)
  else if (['ANGRY', 'ANGRY_POUT', 'DISGUST', 'TSUNDERE', 'YANDERE', 'CONTEMPT', 'ANNOYED', 'ARGUING'].includes(emotionKey)) {
    boxShadow = 'inset 0 0 200px rgba(139, 0, 0, 0.4)';
  }

  // 3.  FEAR / SHOCK / ANXIETY VIBE (Piercing Cold Cyan)
  else if (['FEAR', 'SURPRISE', 'SHOCK', 'HORROR', 'ANXIETY', 'GUILT'].includes(emotionKey)) {
    boxShadow = 'inset 0 0 160px rgba(40, 150, 160, 0.3)';
  }

  // 4.  ISOLATION / VULNERABILITY VIBE (Cold Navy)
  else if (['SAD', 'SADNESS', 'LONELY', 'HURT', 'DANDERE', 'CONFUSION', 'AWKWARDNESS', 'DISAPPOINTMENT', 'EMPATHIC_PAIN', 'SYMPATHY', 'SAD_IDLE'].includes(emotionKey)) {
    boxShadow = 'inset 0 0 150px rgba(10, 25, 60, 0.5)';
  }

  // 5.  SHY / FLUSTERED VIBE (Soft Peach / Light Pink)
  else if (['BASHFUL', 'SHY', 'TEASING', 'EMBARRASSED'].includes(emotionKey)) {
    boxShadow = 'inset 0 0 120px rgba(255, 105, 180, 0.15)';
  }

  // 6.  GLOW / WARM VIBE (Golden Hour Yellow/Orange)
  else if (['HAPPY', 'JOY', 'FUN', 'EXCITEMENT', 'AMUSEMENT', 'PRIDE', 'TRIUMPH', 'CHEERING', 'AWE', 'ADORATION', 'THANKFUL'].includes(emotionKey)) {
    boxShadow = 'inset 0 0 100px rgba(255, 215, 0, 0.1)';
  }

  // 7.  DREAM / SLEEP VIBE (Heavy Shadow / Vignette)
  else if (['SLEEPY', 'SLEEPING', 'YAWN', 'LAYING'].includes(emotionKey)) {
    boxShadow = 'inset 0 0 250px rgba(5, 5, 10, 0.7)';
  }

  // 8.  FOCUS / THINKING VIBE (Subtle Deep Purple)
  else if (['THINKING', 'FOCUS', 'INTEREST', 'FEMALETHINKING', 'TYPING'].includes(emotionKey)) {
    boxShadow = 'inset 0 0 120px rgba(70, 50, 120, 0.15)';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none', // Critical: ensures users can click UI underneath
        transition: 'box-shadow 1.5s ease-in-out', // Super smooth 1.5s psychological fade
        zIndex: 50,
        boxShadow: boxShadow
      }}
    />
  );
};


interface VRMCharacterProps {
  onControllerReady?: (controller: CharacterManager) => void;
}

export const VRMCharacter: React.FC<VRMCharacterProps> = ({
  onControllerReady
}) => {

  const characterManagerRef = useRef<CharacterManager | null>(null);

  //  Phase 3: UI Poltergeist (DOM Scrambling & Button Dodge)
  usePoltergeistUI({ chatSelector: '[data-chat-message]' });

  //  Cleanup: Reset global controller on unmount
  useEffect(() => {
    return () => {
      (window as any).characterManager = null;
    };
  }, []);


  return (
    <div
      className="w-full h-full bg-transparent relative overflow-hidden"
      data-aura-wrap
      data-chat-container="true"
    >
      <Canvas
        shadows
        camera={{ position: [0, 0.5, 4], fov: 35 }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping
        }}
        dpr={[1, 2]} // Performance and Sharpness balance
        style={{ background: '#080810' }}

      >
        {/*  NOTE: Lights yahan se hata di hain kyunki SceneContent 
           ke andar lights pehle se set hain. Double lighting error khatam!
        */}

        <Suspense fallback={null}>
          <SceneContent
            onControllerReady={(controller) => {
              characterManagerRef.current = controller;
              //  Global Access for Music Analyzer & Speech
              (window as any).characterManager = controller;

              if (onControllerReady) onControllerReady(controller);
            }}
          />
          <GameVibeR3F />
        </Suspense>
      </Canvas>

      <CinematicAtmosphere />
      <PsychologicalOverlay />



      <KissOverlay />  {/* ← YEH ADD KARO */}
    </div>
  );
};


export default VRMCharacter;