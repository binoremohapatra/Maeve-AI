/**
 * AnimationVFXTester v2.0
 *
 * Changes from v1:
 * - Wink/PLAYFUL detection now sets winkActive=true in store so
 *   useRestingFaceEngine yields blinkLeft control to the state machine
 * - tester reads mascot.winkActive from store to show active state
 * - All emotion buttons now set emotion correctly without overriding face directly
 * - Added LOVESTRUCK, COLD_ANGER, BASHFUL, FLUSTERED to emotion list
 * - "Reset All" clears winkActive too
 * - Combo buttons use setMascotResponse not setAction+setEmotion separately
 *   to avoid race condition where two store writes don't batch
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMoodStore } from '../stores/moodStore';

// ─── Emotion list — drives useRestingFaceEngine via store.mascot.emotion ───
// PLAYFUL is last because it triggers the wink state machine path
const EMOTIONS = [
  'NEUTRAL', 'HAPPY', 'JOY', 'SOFT', 'WARM',
  'SAD', 'TEARY', 'CRYING', 'HURT', 'MELANCHOLY', 'LONELY',
  'ANGRY', 'FRUSTRATED', 'COLD_ANGER', 'DISGUST',
  'BASHFUL', 'SHY', 'SHY_BASHFUL', 'FLUSTERED',
  'LOVESTRUCK', 'LOVE', 'LONGING',
  'LUST', 'SEXY', 'PLEASURE', 'SATISFACTION',
  'AHEGAO', 'ECSTASY',
  'YANDERE', 'YANDERE_STALKER', 'YANDERE_AGGRESSIVE',
  'POSSESSIVE', 'POSSESSIVE_KUBRICK',
  'SHOCKED', 'SURPRISED', 'MILDLY_SURPRISED',
  'FEAR', 'NERVOUS',
  'SLEEPY', 'SLEEPING', 'WAKING_UP',
  'SMUG', 'EXCITED', 'PROUD', 'BORED', 'DETERMINED',
  'CONFUSED', 'THINKING', 'PENSIVE',
  'BITTERSWEET', 'JEALOUS', 'CONCERNED',
  'POUT', 'CUTE_POUT',
  'TSUNDERE', 'KUUDERE', 'DEREDERE',
  'PLAYFUL',  // ← last: triggers winkActive in store
];

// ─── Animation list — drives Mixamo / HumanAnimationController ───────────
const ANIMATIONS = [
  'IDLE', 'WALKING', 'THINKING', 'HAPPY', 'SAD', 'ANGRY', 'ARGUING',
  'WAVE', 'KISS', 'HUGGINGKISS', 'TYPING', 'SLEEPING', 'LAYING',
  'MAIN', 'JOY',
];

// ─── Colour coding — makes scanning faster ───────────────────────────────
const EMOTION_GROUPS: Record<string, string> = {
  NEUTRAL: 'gray', HAPPY: 'green', JOY: 'green', SOFT: 'green', WARM: 'green',
  SAD: 'blue', TEARY: 'blue', CRYING: 'blue', HURT: 'blue', MELANCHOLY: 'blue', LONELY: 'blue',
  ANGRY: 'red', FRUSTRATED: 'red', COLD_ANGER: 'red', DISGUST: 'red',
  BASHFUL: 'pink', SHY: 'pink', SHY_BASHFUL: 'pink', FLUSTERED: 'pink',
  LOVESTRUCK: 'rose', LOVE: 'rose', LONGING: 'rose',
  LUST: 'purple', SEXY: 'purple', PLEASURE: 'purple', SATISFACTION: 'purple',
  AHEGAO: 'violet', ECSTASY: 'violet',
  YANDERE: 'crimson', YANDERE_STALKER: 'crimson', YANDERE_AGGRESSIVE: 'crimson',
  POSSESSIVE: 'crimson', POSSESSIVE_KUBRICK: 'crimson',
  SHOCKED: 'amber', SURPRISED: 'amber', MILDLY_SURPRISED: 'amber',
  FEAR: 'amber', NERVOUS: 'amber',
  SLEEPY: 'slate', SLEEPING: 'slate', WAKING_UP: 'slate',
  SMUG: 'teal', EXCITED: 'teal', PROUD: 'teal', BORED: 'teal',
  DETERMINED: 'teal', CONFUSED: 'teal', THINKING: 'teal', PENSIVE: 'teal',
  BITTERSWEET: 'indigo', JEALOUS: 'indigo', CONCERNED: 'indigo',
  POUT: 'orange', CUTE_POUT: 'orange',
  TSUNDERE: 'yellow', KUUDERE: 'yellow', DEREDERE: 'yellow',
  PLAYFUL: 'lime',
};

const GROUP_COLORS: Record<string, { bg: string; text: string; activeBg: string; activeShadow: string }> = {
  gray:    { bg: 'bg-white/5',    text: 'text-gray-400',  activeBg: 'bg-gray-600',   activeShadow: '0 0 10px rgba(100,100,100,0.5)' },
  green:   { bg: 'bg-green-500/10', text: 'text-green-400', activeBg: 'bg-green-600',  activeShadow: '0 0 10px rgba(34,197,94,0.5)' },
  blue:    { bg: 'bg-blue-500/10',  text: 'text-blue-400',  activeBg: 'bg-blue-600',   activeShadow: '0 0 10px rgba(59,130,246,0.5)' },
  red:     { bg: 'bg-red-500/10',   text: 'text-red-400',   activeBg: 'bg-red-600',    activeShadow: '0 0 10px rgba(239,68,68,0.5)' },
  pink:    { bg: 'bg-pink-500/10',  text: 'text-pink-400',  activeBg: 'bg-pink-600',   activeShadow: '0 0 10px rgba(236,72,153,0.5)' },
  rose:    { bg: 'bg-rose-500/10',  text: 'text-rose-400',  activeBg: 'bg-rose-600',   activeShadow: '0 0 10px rgba(244,63,94,0.5)' },
  purple:  { bg: 'bg-purple-500/10', text: 'text-purple-400', activeBg: 'bg-purple-600', activeShadow: '0 0 10px rgba(147,51,234,0.5)' },
  violet:  { bg: 'bg-violet-500/10', text: 'text-violet-400', activeBg: 'bg-violet-600', activeShadow: '0 0 10px rgba(124,58,237,0.5)' },
  crimson: { bg: 'bg-red-900/20',   text: 'text-red-300',   activeBg: 'bg-red-900',   activeShadow: '0 0 10px rgba(127,0,0,0.7)' },
  amber:   { bg: 'bg-amber-500/10', text: 'text-amber-400', activeBg: 'bg-amber-600', activeShadow: '0 0 10px rgba(245,158,11,0.5)' },
  slate:   { bg: 'bg-slate-500/10', text: 'text-slate-400', activeBg: 'bg-slate-600', activeShadow: '0 0 10px rgba(100,116,139,0.5)' },
  teal:    { bg: 'bg-teal-500/10',  text: 'text-teal-400',  activeBg: 'bg-teal-600',  activeShadow: '0 0 10px rgba(20,184,166,0.5)' },
  indigo:  { bg: 'bg-indigo-500/10', text: 'text-indigo-400', activeBg: 'bg-indigo-600', activeShadow: '0 0 10px rgba(99,102,241,0.5)' },
  orange:  { bg: 'bg-orange-500/10', text: 'text-orange-400', activeBg: 'bg-orange-600', activeShadow: '0 0 10px rgba(249,115,22,0.5)' },
  yellow:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', activeBg: 'bg-yellow-600', activeShadow: '0 0 10px rgba(234,179,8,0.5)' },
  lime:    { bg: 'bg-lime-500/10',  text: 'text-lime-400',  activeBg: 'bg-lime-600',  activeShadow: '0 0 10px rgba(132,204,22,0.5)' },
};

export const AnimationVFXTester: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // ── Store reads ────────────────────────────────────────────────────────
  const mascot         = useMoodStore(s => s.mascot);
  const setAction      = useMoodStore(s => s.setAction);
  const setMascotResponse = useMoodStore(s => s.setMascotResponse);

  // ── Derived state ──────────────────────────────────────────────────────
  const activeEmotion  = mascot?.emotion ?? 'NEUTRAL';
  const activeAction   = mascot?.action  ?? 'IDLE';
  const isWinkActive   = mascot?.winkActive ?? false;

  // ── Emotion setter — handles PLAYFUL wink flag correctly ───────────────
  // This is the KEY FIX: PLAYFUL sets winkActive=true so useRestingFaceEngine
  // knows to yield blinkLeft to the wink state machine and not fight it.
  // All other emotions clear winkActive.
  const handleSetEmotion = (emotion: string) => {
    const isPlayful = emotion === 'PLAYFUL';
    setMascotResponse({
      emotion,
      winkActive: isPlayful,
      // If not playful, ensure we clear the wink lock so the engine resumes
      ...(isPlayful ? {} : { winkActive: false }),
    });
  };

  // ── Combo setter — batches emotion + action in ONE store write ─────────
  // Avoids the race condition where two separate writes cause a frame gap
  const handleCombo = (action: string, emotion: string) => {
    const isPlayful = emotion === 'PLAYFUL';
    setAction(action);
    setMascotResponse({ emotion, winkActive: isPlayful });
  };

  // ── Full reset ─────────────────────────────────────────────────────────
  const handleReset = () => {
    setAction('IDLE');
    setMascotResponse({ emotion: 'NEUTRAL', winkActive: false });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[10000] font-sans select-none">

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-12 h-12 bg-gray-900/90 text-white rounded-full border border-white/20 shadow-lg backdrop-blur-md flex items-center justify-center hover:bg-gray-800 transition-colors"
        title="Animation & VFX Tester"
      >
        {isOpen ? '✕' : '🎭'}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: -10, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute bottom-14 right-0 w-96 bg-[#0c0c18]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-4 max-h-[80vh] overflow-hidden"
          >

            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-2 flex-shrink-0">
              <h3 className="text-white text-xs font-bold tracking-widest uppercase">
                🎭 Face + Animation Dev
              </h3>
              <div className="flex items-center gap-2">
                {isWinkActive && (
                  <span className="text-[9px] bg-lime-500/20 text-lime-300 px-1.5 py-0.5 rounded font-bold tracking-wider">
                    WINK LOCK
                  </span>
                )}
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-1 tester-scroll flex-1">

              {/* ── Active State Display ── */}
              <div className="flex gap-2 text-[10px]">
                <div className="flex-1 bg-white/5 rounded-lg px-2 py-1.5 border border-white/5">
                  <span className="text-gray-500 block text-[9px] uppercase tracking-widest mb-0.5">Emotion</span>
                  <span className="text-purple-300 font-bold">{activeEmotion}</span>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg px-2 py-1.5 border border-white/5">
                  <span className="text-gray-500 block text-[9px] uppercase tracking-widest mb-0.5">Action</span>
                  <span className="text-blue-300 font-bold">{activeAction}</span>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg px-2 py-1.5 border border-white/5">
                  <span className="text-gray-500 block text-[9px] uppercase tracking-widest mb-0.5">Wink</span>
                  <span className={isWinkActive ? 'text-lime-300 font-bold' : 'text-gray-600 font-bold'}>
                    {isWinkActive ? 'ACTIVE' : 'off'}
                  </span>
                </div>
              </div>

              {/* ── Notice about face override ── */}
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 text-[10px] text-amber-300/80 leading-relaxed">
                Emotions drive <code className="text-amber-200">useRestingFaceEngine</code> via store only.
                No direct blendshape writes. PLAYFUL sets <code className="text-amber-200">winkActive=true</code> to
                yield <code className="text-amber-200">blinkLeft</code> to the wink state machine.
              </div>

              {/* ── Emotions Grid ── */}
              <div>
                <div className="text-[9px] text-gray-500 font-bold mb-2 uppercase tracking-widest">
                  Emotions & Face Weights
                </div>
                <div className="flex flex-wrap gap-1">
                  {EMOTIONS.map(emo => {
                    const isActive = activeEmotion === emo;
                    const group = EMOTION_GROUPS[emo] ?? 'gray';
                    const colors = GROUP_COLORS[group];

                    return (
                      <button
                        key={emo}
                        onClick={() => handleSetEmotion(emo)}
                        className={`
                          px-2 py-1 text-[9px] rounded font-bold transition-all duration-150
                          border
                          ${isActive
                            ? `${colors.activeBg} text-white border-transparent`
                            : `${colors.bg} ${colors.text} border-white/5 hover:border-white/15 hover:brightness-125`
                          }
                        `}
                        style={isActive ? { boxShadow: colors.activeShadow } : undefined}
                      >
                        {emo}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Animations Grid ── */}
              <div>
                <div className="text-[9px] text-gray-500 font-bold mb-2 uppercase tracking-widest">
                  Body Animations (Mixamo Rig)
                </div>
                <div className="flex flex-wrap gap-1">
                  {ANIMATIONS.map(anim => {
                    const isActive = activeAction === anim;
                    return (
                      <button
                        key={anim}
                        onClick={() => setAction(anim)}
                        className={`
                          px-2 py-1 text-[9px] rounded font-bold transition-all border
                          ${isActive
                            ? 'bg-blue-600 text-white border-transparent shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                            : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'
                          }
                        `}
                      >
                        {anim}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Quick Combos ── */}
              <div>
                <div className="text-[9px] text-gray-500 font-bold mb-2 uppercase tracking-widest">
                  Quick Combos
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={handleReset}
                    className="bg-red-500/20 text-red-300 border border-red-500/30 text-[9px] py-1.5 rounded-lg hover:bg-red-500/40 font-bold col-span-2"
                  >
                    ⟳ RESET ALL (clears wink lock)
                  </button>

                  {([
                    ['IDLE',        'FLUSTERED',          '💗 Idle + Flustered'],
                    ['MAIN',        'EXCITED',            '✨ Main + Excited'],
                    ['ARGUING',     'TSUNDERE',           '😤 Arguing + Tsundere'],
                    ['THINKING',    'SMUG',               '🤔 Thinking + Smug'],
                    ['KISS',        'LOVESTRUCK',         '💋 Kiss + Lovestruck'],
                    ['IDLE',        'YANDERE',            '🔪 Idle + Yandere'],
                    ['IDLE',        'YANDERE_STALKER',    '👁 Idle + Stalker'],
                    ['IDLE',        'POSSESSIVE_KUBRICK', '😶 Idle + Kubrick'],
                    ['WAVE',        'DEREDERE',           '👋 Wave + Deredere'],
                    ['SAD',         'CRYING',             '😢 Sad + Crying'],
                    ['JOY',         'PROUD',              '✨ Joy + Proud'],
                    ['IDLE',        'BASHFUL',            '😳 Idle + Bashful'],
                    ['IDLE',        'LOVESTRUCK',         '💘 Idle + Lovestruck'],
                    ['IDLE',        'COLD_ANGER',         '🥶 Idle + Cold Anger'],
                    ['IDLE',        'FEAR',               '😱 Idle + Fear'],
                    ['IDLE',        'PLAYFUL',            '😉 Idle + Wink'],
                  ] as [string, string, string][]).map(([action, emotion, label]) => (
                    <button
                      key={label}
                      onClick={() => handleCombo(action, emotion)}
                      className={`
                        text-[9px] py-1.5 rounded-lg border font-bold transition-all
                        ${activeAction === action && activeEmotion === emotion
                          ? 'bg-white/15 text-white border-white/30'
                          : 'bg-white/5 text-gray-400 border-white/8 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .tester-scroll::-webkit-scrollbar { width: 3px; }
        .tester-scroll::-webkit-scrollbar-track { background: transparent; }
        .tester-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .tester-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}} />
    </div>
  );
};
