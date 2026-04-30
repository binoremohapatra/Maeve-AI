import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Cpu, HardDrive, Terminal, Wifi, ShieldCheck, Zap, Thermometer } from 'lucide-react';
import { useMoodStore } from '../stores/moodStore';
import { useScreenSize } from '../hooks/useScreenSize';

interface Props {
  onBack: () => void;
}

export const MascotDeviceScreen: React.FC<Props> = ({ onBack }) => {
  const store = useMoodStore() as any;
  const setAnimation = store.setAnimation;
  const { width, height } = useScreenSize();

  const userId = "user_pro_01";
  const [stats, setStats] = useState({ cpu: 32, ram: 58, temperature: 42, storage: 65 });
  const [logs, setLogs] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  //  Scroller के लिए Ref
  const scrollRef = useRef<HTMLDivElement>(null);

  //  SCALING: स्क्रीन के हिसाब से सब छोटा-बड़ा होगा
  const isSmall = width < 1200;
  const scaleFactor = Math.min(width / 1400, 1);

  useEffect(() => {
    if (setAnimation) setAnimation('GodDance');
    return () => { if (setAnimation) setAnimation('Idle'); };
  }, [setAnimation]);

  //  FIX: स्क्रीन को ऊपर जाने से रोकने के लिए मैनुअल स्क्रॉल
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/device/status/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setStats(prev => ({
            cpu: data.cpu ?? prev.cpu,
            ram: data.ram ?? prev.ram,
            temperature: data.temperature ?? prev.temperature,
            storage: data.storage ?? prev.storage
          }));
          setIsOnline(true);
        }
      } catch (e) { setIsOnline(false); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOnline) return;
      const cmds = ["Neural pathway optimized", "Buffer overflow avoided", "GodDance active", "System nominal", "Security Uplink: OK"];
      const newLog = `[${new Date().toLocaleTimeString().split(' ')[0]}] ${cmds[Math.floor(Math.random() * cmds.length)]}`;
      setLogs(prev => [...prev, newLog].slice(-50));
    }, 2800);
    return () => clearInterval(interval);
  }, [isOnline]);

  const CircularGauge = ({ label, value, color, icon: Icon }: any) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.75;
    const strokeDashoffset = arcLength * (1 - value / 100);

    return (
      <div className="flex flex-col items-center justify-between p-3 bg-white/[0.03] rounded-[24px] border border-white/5 backdrop-blur-2xl aspect-square w-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] transition-all hover:bg-white/10 group">
        <span className="text-[8px] font-black tracking-[0.2em] text-white/30 uppercase">{label}</span>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-full h-full rotate-[135deg]" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} fill="transparent" stroke="currentColor" strokeWidth="5"
              strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round" className="text-white/5" />
            <motion.circle cx="40" cy="40" r={radius} fill="transparent" stroke="currentColor" strokeWidth="6"
              strokeDasharray={`${arcLength} ${circumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
              className={`${color} shadow-[0_0_15px_currentColor]`}
              animate={{ strokeDashoffset }} transition={{ type: "spring", stiffness: 45, damping: 10 }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pt-1">
            <Icon size={14} className={`${color.replace('stroke-', 'text-')} opacity-40 group-hover:opacity-80`} />
          </div>
        </div>
        <span className="text-lg font-black italic text-white tracking-tighter">{value}%</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col p-6 md:p-10 pointer-events-none overflow-hidden">

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/*  HEADER */}
      <motion.div
        style={{ scale: scaleFactor, transformOrigin: 'top left' }}
        initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="pointer-events-auto w-full flex justify-between items-center mb-8"
      >
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl hover:bg-white/20 transition-all">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic text-white tracking-tighter uppercase leading-none"> Device Control</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-red-500'}`} />
              <p className="text-white/40 text-[9px] font-bold tracking-[0.2em] uppercase">{isOnline ? "Link Established" : "Offline"}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full flex items-center gap-3 backdrop-blur-xl">
          <Wifi size={14} className="text-white/20" />
          <ShieldCheck size={14} className="text-emerald-400" />
        </div>
      </motion.div>

      {/*  MAIN HUD GRID */}
      <div className="flex flex-row items-stretch justify-between w-full h-full max-h-[75vh] gap-4 pointer-events-none overflow-hidden">

        {/* LEFT: VITALS */}
        <motion.div
          style={{ scale: scaleFactor, transformOrigin: 'left center' }}
          initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="flex flex-col gap-3 w-[150px] pointer-events-auto shrink-0"
        >
          <CircularGauge label="Neural CPU" value={stats.cpu} icon={Cpu} color="stroke-blue-400" />
          <CircularGauge label="Memory Bank" value={stats.ram} icon={Zap} color="stroke-purple-400" />
          <CircularGauge label="Thermal Core" value={stats.temperature} icon={Thermometer} color={stats.temperature > 75 ? "stroke-red-500" : "stroke-orange-400"} />
          <CircularGauge label="Storage Hub" value={stats.storage} icon={HardDrive} color="stroke-emerald-400" />
        </motion.div>

        {/* MIDDLE: Character Space (Flex-grow keeps panels at edges) */}
        <div className="flex-1" />

        {/* RIGHT: TERMINAL */}
        <motion.div
          style={{ scale: scaleFactor, transformOrigin: 'right center' }}
          initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="w-full max-w-[300px] pointer-events-auto h-full flex flex-col overflow-hidden"
        >
          <div className="relative flex-1 flex flex-col bg-black/50 border border-white/10 rounded-[35px] shadow-2xl backdrop-blur-[40px] overflow-hidden">
            <div className="bg-white/5 px-5 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Terminal size={16} className="text-emerald-400" />
                <span className="text-[9px] font-black tracking-[0.3em] text-white/50 uppercase italic">Powershell</span>
              </div>
            </div>

            {/*  HIDDEN SCROLLER: Won't affect screen position */}
            <div
              ref={scrollRef}
              className="p-5 font-mono text-[9px] text-emerald-400/60 overflow-y-auto flex-1 space-y-3 scrollbar-hide"
            >
              <AnimatePresence mode="popLayout">
                {logs.map((log, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 border-l border-emerald-500/10 pl-3 py-0.5">
                    <span className="text-white/5 font-bold">{i + 1}</span>
                    <span className="break-all tracking-tight leading-relaxed uppercase">{log}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] opacity-10" />
          </div>
        </motion.div>

      </div>
    </div>
  );
};