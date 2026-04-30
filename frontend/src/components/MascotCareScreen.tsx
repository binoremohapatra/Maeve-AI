import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Fingerprint, Utensils, Sparkles, Heart, Zap, Moon, Sun } from 'lucide-react'; //  Activity की जगह Zap लगाया
import { useMoodStore } from '../stores/moodStore';
import { useScreenSize } from '../hooks/useScreenSize';

export const MascotCareScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    userProfile, updateUserProfile, learnedFacts,
    careStats, updateCareStats, setMascotResponse,
    lifeStats, updateLifeStats,
    isLightsOn, setLightsOn, setAction, mascot
  } = useMoodStore();

  const { width, height } = useScreenSize();

  //  Scale factor adjusted to not squash the character or the HUDs
  const scaleFactor = Math.min(width / 1400, height / 900, 1);

  const [formData, setFormData] = useState(userProfile || { name: "", role: "student" as any, age: 20, field: "", height: 0, weight: 0 });
  const [isSaving, setIsSaving] = useState(false);

  //  SLEEP / WAKE TOGGLE LOGIC
  const handleSleepToggle = () => {
    const newLightState = !isLightsOn;
    setLightsOn(newLightState);

    if (newLightState) {
      setAction("YAWN");
      setMascotResponse({ replyText: "Good morning! *Yawn*... Systems booting up.", mascotAction: "YAWN", emotion: "relaxed" });
      setTimeout(() => {
        setAction("IDLE");
      }, 5000);
    } else {
      setAction("SLEEPING");
      setMascotResponse({ replyText: "Goodnight, darling. Saving energy...", mascotAction: "SLEEPING", emotion: "relaxed" });
    }
  };

  // Identity Save Logic
  const handleProfileSave = async () => {
    setIsSaving(true);
    await updateUserProfile(formData);
    setMascotResponse({
      replyText: `Identity Matrix updated. I will remember you as ${formData.name}, Darling.`,
      mascotAction: "CLAP",
      emotion: "HAPPY"
    });
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleAction = async (type: 'FEED' | 'CLEAN' | 'SOCIAL') => {
    let newCare = { ...careStats };
    let newLife = { ...lifeStats };
    let reply = "";
    let action = "HAPPY";

    if (type === 'FEED') {
      newCare.hunger = Math.min(100, (newCare.hunger || 0) + 20);
      reply = "Mmm! Delicious. Energy restored!";
      action = "THANK";
    } else if (type === 'CLEAN') {
      newCare.hygiene = 100;
      reply = "Feeling fresh and sparkly now!";
      action = "SHY";
    } else if (type === 'SOCIAL') {
      newCare.social = Math.min(100, (newCare.social || 0) + 15);
      reply = "I love spending time with you!";
      action = "REAL_KISS";
    }

    await updateCareStats(newCare);
    await updateLifeStats(newLife);
    setMascotResponse({ replyText: reply, mascotAction: action, emotion: "happy" });
    if (action !== "SLEEPING") setAction(action);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col pointer-events-none overflow-hidden">

      {/*  1. TOP: LEFT-ALIGNED HEADER */}
      <motion.div
        style={{ scale: scaleFactor }}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full pt-10 px-12 flex justify-start pointer-events-auto"
      >
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-full flex items-center gap-6 shadow-2xl">
          <button
            onClick={onBack}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="text-left">
            <h1 className="text-xl font-black text-white uppercase tracking-[0.3em] italic">Care Protocol</h1>
            <div className="flex items-center gap-2">
              <Fingerprint size={12} className="text-pink-500" />
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Maintenance & Synergy Sync</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/*  MIDDLE HUD (Torso Alignment - Left & Right Pinned) */}
      <div className="flex-1 w-full px-12 flex items-center justify-between">

        {/* LEFT HUD: Identity Matrix (Converted to Vertical List) */}
        <motion.div
          style={{ scale: scaleFactor, transformOrigin: 'left center' }}
          initial={{ x: -100 }} animate={{ x: 0 }}
          className="w-full max-w-[400px] pointer-events-auto"
        >
          <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-2">
              <Fingerprint size={20} className="text-pink-500" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Identity Matrix</span>
            </div>

            {/*  STACKED LAYOUT: No more side-by-side squashing */}
            <div className="flex flex-col gap-4">
              <InputField label="Operator Name" value={formData.name} onChange={(v: string) => setFormData({ ...formData, name: v })} />
              <SelectField label="Current Role" value={formData.role} options={['student', 'professional', 'freelancer']} onChange={(v: any) => setFormData({ ...formData, role: v })} />
              <InputField label="Subject Age" type="number" value={formData.age} onChange={(v: string) => setFormData({ ...formData, age: parseInt(v) })} />
            </div>

            <button
              onClick={handleProfileSave}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(219,39,119,0.3)]"
            >
              {isSaving ? "SYNCING..." : "UPDATE IDENTITY"}
            </button>
          </div>
        </motion.div>

        {/* RIGHT HUD: Interaction & Stats (Converted to Vertical List) */}
        <motion.div
          style={{ scale: scaleFactor, transformOrigin: 'right center' }}
          initial={{ x: 100 }} animate={{ x: 0 }}
          className="w-full max-w-[380px] pointer-events-auto space-y-6"
        >
          <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-2">
              <Zap size={20} className="text-cyan-400" /> {/*  Activity हटाकर Zap लगाया */}
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Active Maintenance</span>
            </div>

            {/*  ACTION STACK: Vertical list for better hit areas */}
            <div className="flex flex-col gap-3 mt-4">
              <ActionBtn icon={Utensils} label="Feed" onClick={() => handleAction('FEED')} />
              <ActionBtn icon={Sparkles} label="Clean" onClick={() => handleAction('CLEAN')} />
              <ActionBtn icon={Heart} label="Socialize" onClick={() => handleAction('SOCIAL')} />

              {/* SLEEP BUTTON */}
              <button
                onClick={handleSleepToggle}
                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all active:scale-95 group ${isLightsOn ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-indigo-900/50 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]'}`}
              >
                <span className="text-[10px] font-black text-white/60 uppercase group-hover:text-white">
                  {isLightsOn ? "Power Down / Sleep" : "Wake Systems"}
                </span>
                {isLightsOn ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-indigo-300" />}
              </button>
            </div>
          </div>

          {/* LIVE AI MEMORY LOGS */}
          <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[30px] p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <Brain size={16} className="text-purple-400" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Memory Logs</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {learnedFacts.length > 0 ? learnedFacts.map((f, i) => (
                <span key={i} className="text-[9px] bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-lg text-white/60 font-bold italic">"{f}"</span>
              )) : (
                <span className="text-[9px] text-white/20 italic tracking-wider uppercase">Searching for neural patterns...</span>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

//  REUSABLE COMPONENTS
const InputField = ({ label, value, onChange, type = "text" }: any) => (
  <div className="w-full">
    <label className="text-[9px] text-white/30 font-black uppercase mb-1.5 block ml-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-pink-500 outline-none transition-all placeholder:text-white/10 focus:bg-white/10"
    />
  </div>
);

const SelectField = ({ label, value, options, onChange }: any) => (
  <div className="w-full">
    <label className="text-[9px] text-white/30 font-black uppercase mb-1.5 block ml-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-sm text-white outline-none cursor-pointer hover:bg-zinc-800 transition-colors"
    >
      {options.map((o: string) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
    </select>
  </div>
);

const ActionBtn = ({ icon: Icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all active:scale-95 group"
  >
    <span className="text-[10px] font-black text-white/60 uppercase group-hover:text-white tracking-[0.2em]">{label}</span>
    <Icon size={18} className="text-white/40 group-hover:text-white transition-all transform group-hover:scale-110" />
  </button>
);