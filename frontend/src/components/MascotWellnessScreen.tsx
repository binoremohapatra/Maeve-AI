import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Brain, Battery, Moon, Activity, ShieldAlert, Zap } from 'lucide-react';
import { useMoodStore } from '../stores/moodStore';
import { useScreenSize } from '../hooks/useScreenSize';

interface Props {
  onBack: () => void;
}

export const MascotWellnessScreen: React.FC<Props> = ({ onBack }) => {
  const { lifeStats, updateLifeStats, setMascotResponse, mascot } = useMoodStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const { width, height } = useScreenSize();

  //  SCALING: Care Screen ke saath match karne ke liye denominator 1400 rakha hai
  const scaleFactor = Math.min(width / 1400, height / 900, 1);

  const score = Math.round((lifeStats.energy + lifeStats.sleep + (100 - lifeStats.stress) + lifeStats.happiness) / 4);

  //  Empathy Reaction Logic (Retained from)
  useEffect(() => {
    if (score <= 30 && mascot.action !== 'SAD_IDLE') {
        setMascotResponse({
          replyText: "System failure imminent... I feel so weak.",
          mascotAction: 'SAD_IDLE', 
          emotion: 'sad'
        });
    } else if (score >= 85 && mascot.action !== 'VICTORY') {
        setMascotResponse({
          replyText: "System Optimal! We are the best, Darling!",
          mascotAction: 'VICTORY',
          emotion: 'happy'
        });
    } else if (score > 30 && score < 85 && mascot.action !== 'IDLE') {
        setMascotResponse({
          replyText: "System stable. We are doing fine.",
          mascotAction: 'IDLE',
          emotion: 'neutral'
        });
    }
  }, [score, mascot.action, setMascotResponse]);

  const handleStatUpdate = (stat: string, value: number) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    updateLifeStats({ ...lifeStats, [stat]: clampedValue });
    setIsEditing(null);
  };

  const getTheme = (value: number, type: string) => {
    if (type === 'stress') {
      return value > 70 ? 'text-red-500 bg-red-500' : 'text-cyan-400 bg-cyan-500';
    }
    return value < 30 ? 'text-red-500 bg-red-500' : 'text-green-400 bg-green-500';
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col pointer-events-none overflow-hidden">
      
      {/*  TOP ROW: Navigation & Critical Alerts */}
      <div className="w-full flex justify-between items-start p-6 md:p-10">
        <motion.div 
          style={{ scale: scaleFactor, transformOrigin: 'top left' }}
          initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="pointer-events-auto bg-black/60 backdrop-blur-2xl border border-white/10 p-2 pr-8 rounded-full flex items-center gap-4 shadow-2xl"
        >
          <button onClick={onBack} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all active:scale-90">
            <ArrowLeft size={24} />
          </button>
          <div className="text-left">
            <h1 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Vital Matrix</h1>
            <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Biometric Link Active</span>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {lifeStats.stress > 80 && (
            <motion.div 
              style={{ scale: scaleFactor, transformOrigin: 'top right' }}
              initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              className="pointer-events-auto bg-red-500/20 border border-red-500/50 backdrop-blur-xl px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl"
            >
              <ShieldAlert className="text-red-500 animate-bounce" size={24} />
              <div className="flex flex-col">
                <span className="text-xs font-black text-red-500 uppercase">Critical Stress</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/*  MIDDLE SECTION: MATCHING CARE SCREEN LAYOUT */}
      {/* - px-12: Isse wahi distance aayega jo Care screen me hai.
          - justify-between: Components ko kinaro ki taraf dhakel dega.
      */}
      <div className="flex-1 w-full px-12 flex flex-row items-center justify-between pointer-events-none">
        
        {/* LEFT HUD: Vital List */}
        <motion.div 
          style={{ scale: scaleFactor, transformOrigin: 'left center' }}
          initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="w-full max-w-[420px] pointer-events-auto"
        >
          <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[40px] p-6 shadow-2xl space-y-4">
             <div className="flex justify-between items-center px-1 border-b border-white/10 pb-3">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Live Core Vitals</span>
                <Activity size={16} className="text-white/20" />
             </div>
             
             <div className="flex flex-col gap-3">
               {[
                 { key: 'energy', label: 'Energy Core', icon: Battery },
                 { key: 'stress', label: 'Neural Load', icon: Brain },
                 { key: 'sleep', label: 'Stasis Cycle', icon: Moon },
                 { key: 'happiness', label: 'Affection', icon: Heart }
               ].map((stat) => {
                 const val = lifeStats[stat.key as keyof typeof lifeStats] as number;
                 const theme = getTheme(val, stat.key);
                 return (
                   <div key={stat.key} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl bg-black/40 ${theme.split(' ')[0]} border border-white/5 shadow-lg`}>
                          <stat.icon size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{stat.label}</span>
                          <div className="flex items-center gap-3">
                              <span className="text-xl font-black text-white">{val}%</span>
                              <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div initial={false} animate={{ width: `${val}%` }} className={`h-full ${theme.split(' ')[1]}`} />
                              </div>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setIsEditing(stat.key)} className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-white transition-opacity">
                        <Zap size={14} />
                      </button>
                   </div>
                 );
               })}
             </div>
          </div>
        </motion.div>

        {/* RIGHT HUD: Stability Gauge */}
        <motion.div 
          style={{ scale: scaleFactor, transformOrigin: 'right center' }}
          initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="w-full max-w-[380px] pointer-events-auto"
        >
          <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[50px] p-8 shadow-2xl flex flex-col items-center">
              <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="88" cy="88" r="80" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                    <motion.circle 
                      cx="88" cy="88" r="80" stroke="currentColor" strokeWidth="6" fill="transparent" 
                      strokeDasharray={502} initial={false}
                      animate={{ strokeDashoffset: 502 - (502 * score) / 100 }}
                      transition={{ duration: 0.8 }}
                      className={`${score > 50 ? 'text-indigo-500' : 'text-red-500'} drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]`}
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-6xl font-black text-white tracking-tighter leading-none">{score}</span>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mt-1">Stability</p>
                  </div>
              </div>

              <div className="w-full mt-8 flex flex-col gap-3">
                  <div className="w-full flex justify-between items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                      <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">Vitality Status</span>
                      <p className={`text-sm font-black ${score < 30 ? 'text-red-500' : 'text-green-400'}`}>
                          {score < 30 ? 'CRITICAL' : 'NOMINAL'}
                      </p>
                  </div>
                  <div className="w-full flex justify-between items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                      <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">Persona Sync</span>
                      <p className={`text-sm font-black ${score < 30 ? 'text-red-400' : 'text-indigo-400'}`}>
                          {score < 30 ? 'DISTRESSED' : 'FRIENDLY'}
                      </p>
                  </div>
              </div>
          </div>
        </motion.div>
      </div>

      <div className="h-20" />

      {/* Editor Overlay RETAINED */}
      <AnimatePresence>
        {isEditing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto p-10">
              <div className="bg-black/90 border border-white/10 p-10 rounded-[40px] w-full max-w-xl flex flex-col gap-8 shadow-[0_0_100px_rgba(0,0,0,1)]">
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest text-center">Adjust {isEditing} Core</h2>
                  <input type="range" min="0" max="100" className="w-full h-3 accent-indigo-500 rounded-full cursor-pointer" onChange={(e) => handleStatUpdate(isEditing, parseInt(e.target.value))} />
                  <button onClick={() => setIsEditing(null)} className="py-4 bg-white/5 rounded-2xl text-white/40 hover:text-white font-black uppercase tracking-widest transition-all">Close Core Link</button>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};