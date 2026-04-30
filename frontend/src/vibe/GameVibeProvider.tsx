import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useMoodStore } from '../stores/moodStore';
import { VerseVFXEngine } from './VerseVFXEngine';
import { PERSONA_TO_VIBE, PersonaType, VIBE_PROFILES } from './vibeConfig';

// ── UI Strain Context (4th wall) ──
interface VibeContextType {
  uiStrain: number;
  triggerImpact: (force: number) => void;
  getFilterStyle: () => React.CSSProperties;
}

const VibeContext = createContext<VibeContextType>({
  uiStrain: 0,
  triggerImpact: () => { },
  getFilterStyle: () => ({}),
});

export const useVibeContext = () => useContext(VibeContext);

// ── Inner R3F Component (must be inside Canvas) ──
export const GameVibeR3F = () => {
  const persona = useMoodStore(s => s.mascot?.persona || 'DEFAULT');
  const activePersona: PersonaType = PERSONA_TO_VIBE[persona] || 'DEFAULT';

  return (
    <VerseVFXEngine
      key={activePersona}
      activePersona={activePersona}
    />
  );
};

// ── Outer Provider (outside Canvas) ──
export const GameVibeProvider = ({ children }: { children: React.ReactNode }) => {
  const persona = useMoodStore(s => s.mascot?.persona || 'DEFAULT');
  const [uiStrain, setUiStrain] = useState(0);
  const animFrameRef = useRef<number>(0);
  const impactRef = useRef(0);

  const triggerImpact = useCallback((force: number) => {
    impactRef.current = force;
  }, []);

  // UI strain animation loop — outside Canvas
  useEffect(() => {
    const activePersona: PersonaType = PERSONA_TO_VIBE[persona] || 'DEFAULT';
    const targetStrain = VIBE_PROFILES[activePersona].uiStrained;

    const loop = () => {
      setUiStrain(prev => {
        const diff = targetStrain - prev;
        return Math.abs(diff) < 0.001 ? targetStrain : prev + diff * 0.05;
      });
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [persona]);

  const getFilterStyle = useCallback((): React.CSSProperties => {
    if (uiStrain < 0.01) return {};
    const t = Date.now() / 1000;
    return {
      filter: [
        `blur(${uiStrain * 1.5}px)`,
        `hue-rotate(${uiStrain * 45}deg)`,
      ].join(' '),
      transform: `translate(${Math.sin(t * 8) * uiStrain * 4}px, ${Math.cos(t * 6) * uiStrain * 2}px)`,
      transition: 'filter 0.1s ease',
    };
  }, [uiStrain]);

  return (
    <VibeContext.Provider value={{ uiStrain, triggerImpact, getFilterStyle }}>
      {children}
    </VibeContext.Provider>
  );
};
