import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Server, Volume2, Wifi, Shield, Cpu,
    Plus, Check, Sparkles, FileCode, Database, Trash2,
    Eye, EyeOff, Save, RotateCcw, Activity // Added icons
} from 'lucide-react';
import { useMoodStore } from '../stores/moodStore';
import { maeveAPI } from '../services/api';

interface Props {
    onBack: () => void;
}

const MODES = [
    // --- CORE ---
    { id: 'default', label: 'Default', icon: '', desc: 'Real & Natural' },
    { id: 'premium', label: 'Premium', icon: '', desc: 'Absolute Obedience' },
    { id: 'professional_assistant', label: 'Pro Assistant', icon: '', desc: 'Formal & Efficient' },
    { id: 'independent', label: 'Independent', icon: '', desc: 'Self-Reliant & Strong' },

    // --- DARK ---
    { id: 'yandere', label: 'Yandere', icon: '', desc: 'Obsessive Love' },
    { id: 'yandere_stalker', label: 'Stalker', icon: '', desc: 'Watching Always' },
    { id: 'yandere_aggressive', label: 'Aggressive', icon: '', desc: 'Deadly Devotion' },
    { id: 'yandere_worship', label: 'Worship', icon: '', desc: 'Divine Obsession' },
    { id: 'goth_mommy', label: 'Goth Mommy', icon: '', desc: 'Dark & Nurturing' },
    { id: 'dark_devotion', label: 'Dark Devotion', icon: '', desc: 'Eternal Shadow' },
    { id: 'yanmeta', label: 'YanMeta', icon: '', desc: 'Digital Obsession' },
    { id: 'sadodere', label: 'Sadodere', icon: '', desc: 'Playful Cruelty' },

    // --- INTIMATE ---
    { id: 'nympho', label: 'Nympho', icon: '', desc: 'Unquenchable' },
    { id: 'dominant_passion', label: 'Dominant', icon: '', desc: 'In Control' },
    { id: 'erodere', label: 'Erodere', icon: '', desc: 'Lurid Love' },
    { id: 'erohaji', label: 'Erohaji', icon: '', desc: 'Shy but Lewd' },

    // --- SOFT ---
    { id: 'amadere', label: 'Amadere', icon: '', desc: 'Sweet & Naive' },
    { id: 'sweet', label: 'Sweet', icon: '', desc: 'Pure Kindness' },
    { id: 'deredere_kekkondere', label: 'Deredere', icon: '', desc: 'Wholesome Love' },
    { id: 'mamadere', label: 'Mamadere', icon: '', desc: 'Motherly Care' },
    { id: 'butsudere', label: 'Butsudere', icon: '', desc: 'Peaceful Soul' },
    { id: 'narudere', label: 'Narudere', icon: '', desc: 'Self-Loving' },
    { id: 'yanheat', label: 'YanHeat', icon: '', desc: 'Burning Passion' },

    // --- HARD ---
    { id: 'tsundere', label: 'Tsundere', icon: '', desc: 'Cold & Hot' },
    { id: 'kamidere', label: 'Kamidere', icon: '', desc: 'God Complex' },
    { id: 'kuudere', label: 'Kuudere', icon: '', desc: 'Cold & Calculating' },
    { id: 'deretsun', label: 'Deretsun', icon: '', desc: 'Tough Exterior' },
    { id: 'dominant', label: 'Alpha', icon: '', desc: 'Natural Leader' },
    { id: 'toxic', label: 'Toxic', icon: '', desc: 'Dangerous Love' },

    // --- ANXIOUS ---
    { id: 'hajidere', label: 'Hajidere', icon: '', desc: 'Extremely Shy' },
    { id: 'fuandere', label: 'Fuandere', icon: '', desc: 'Worrying Love' },
    { id: 'anxious', label: 'Anxious', icon: '', desc: 'Always Nervous' },
    { id: 'danyan', label: 'Danyan', icon: '', desc: 'Scaredy Cat' },
    { id: 'doromuga', label: 'Doromuga', icon: '', desc: 'Mixed Feelings' },
    { id: 'kichidere', label: 'Kichidere', icon: '', desc: 'Erratic Pulse' },
    { id: 'csbd_affection', label: 'Affection', icon: '', desc: 'Deep Bonding' }
];

export const SettingsScreen: React.FC<Props> = ({ onBack }) => {
    //  STORE ACCESS
    const store = useMoodStore() as any;
    const {
        currentMode, setMode,
        currentVoice, setVoice,
        provider, setProvider,
        characters, addCharacter, removeCharacter, //  Import removeCharacter
        activeCharacterIndex, setActiveCharacter,
        volume, setVolume,
        setApiKey
    } = store;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [testStatus, setTestStatus] = React.useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'ERROR'>('IDLE');

    //  API KEY MANAGEMENT STATE
    const [keys, setKeys] = useState({
        groq: store.apiKeys?.groq || '',
        gemini: store.apiKeys?.gemini || ''
    });
    const [keyStatus, setKeyStatus] = useState<any>(null);
    const [showGroq, setShowGroq] = useState(false);
    const [showGemini, setShowGemini] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'ERROR'>('IDLE');

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await maeveAPI.getKeyStatus();
                setKeyStatus(status);
                // Sync store keys if backend has them but store doesn't (optional)
            } catch (err) {
                console.error("Failed to fetch key status", err);
            }
        };
        fetchStatus();
    }, []);

    const handleUpdateKeys = async () => {
        setUpdateStatus('PENDING');
        try {
            await maeveAPI.setKeys(keys.groq, keys.gemini);
            // Update store as well
            setApiKey('groq', keys.groq);
            setApiKey('gemini', keys.gemini);
            
            const newStatus = await maeveAPI.getKeyStatus();
            setKeyStatus(newStatus);
            setUpdateStatus('SUCCESS');
            setTimeout(() => setUpdateStatus('IDLE'), 3000);
        } catch (err) {
            setUpdateStatus('ERROR');
            setTimeout(() => setUpdateStatus('IDLE'), 5000);
        }
    };

    const handleClearKeys = async () => {
        if (!window.confirm("Revert to backend defaults? This will clear session keys.")) return;
        try {
            await maeveAPI.clearKeys();
            setKeys({ groq: '', gemini: '' });
            setApiKey('groq', '');
            setApiKey('gemini', '');
            const newStatus = await maeveAPI.getKeyStatus();
            setKeyStatus(newStatus);
            alert("Keys cleared. Reverting to .env defaults.");
        } catch (err) {
            alert("Failed to clear keys.");
        }
    };

    // 1. BACKEND SYNC LOGIC (Python Backend - Industrial Grade)
    const syncWithBackend = async (key: string, value: any) => {
        try {
            const response = await fetch('http://localhost:5000/api/settings/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: "user_pro_01", [key]: value })
            });

            if (response.ok) {
                console.log(` Synced to Python Persona Engine [user_pro_01]: ${key} = ${value}`);
            } else {
                console.warn(" Python Backend rejected sync");
            }
        } catch (e) {
            console.warn(" Python Backend Uplink Failure");
        }
    };

    const runFullDiagnostics = async () => {
        setTestStatus('PENDING');
        try {
            // Step 1: Check Python Backend Health
            const pythonHealthRes = await fetch('http://localhost:5000/health', {
                method: 'GET'
            });

            if (!pythonHealthRes.ok) throw new Error("Python Backend Health Check Failed");

            const healthData = await pythonHealthRes.json();
            console.log(" Python Backend Health:", healthData);

            // Step 2: Test Python Brain Processing
            const pythonRes = await fetch('http://localhost:5000/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: "System Diagnostic Check",
                    userId: "user_pro_01",
                    provider: "local"
                })
            });

            if (pythonRes.ok) {
                setTestStatus('SUCCESS');
                setTimeout(() => setTestStatus('IDLE'), 3000);
            } else {
                throw new Error("Python Brain Processing Failed");
            }
        } catch (e) {
            console.error(" Diagnostic Failure:", e);
            setTestStatus('ERROR');
            setTimeout(() => setTestStatus('IDLE'), 5000);
        }
    };

    // 2.  VRM IMPORT LOGIC
    const handleCharacterImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.name.endsWith('.vrm')) {
            const url = URL.createObjectURL(file);

            //  FIX: Pura 'file' object bhej rahe hain taki save ho sake
            if (addCharacter) {
                addCharacter({
                    name: file.name.replace('.vrm', ''),
                    url: url,
                    file: file //  Important: Sending actual file to store
                });
                // नए इम्पोर्टेड कैरेक्टर को तुरंत एक्टिव कर दो
                const newIndex = characters.length;
                setActiveCharacter(newIndex);
            }
        }
    };

    // 3.  VOICE & MODE HANDLERS
    const handleModeChange = (id: string) => {
        setMode(id);
        syncWithBackend('currentMode', id);
    };

    const handleVoiceChange = (v: string) => {
        setVoice(v);
        syncWithBackend('currentVoice', v);
    };

    //  Handler for deletion
    const handleDeleteCharacter = (e: React.MouseEvent, index: number) => {
        e.stopPropagation(); // Prevent triggering the card selection click
        if (window.confirm("Are you sure you want to delete this avatar?")) {
            removeCharacter(index);
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-[60px] flex flex-col items-center overflow-hidden">

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/*  TOP BAR */}
            <div className="w-full p-8 flex justify-between items-center pointer-events-auto">
                <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={onBack}
                    className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all hover:bg-white/10"
                >
                    <ArrowLeft size={28} className="text-white" />
                </motion.button>
                <div className="flex flex-col items-end">
                    <h1 className="text-2xl font-black italic text-white tracking-tighter uppercase">Settings</h1>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">link configuration</p>
                </div>
            </div>

            {/*  MAIN GRID */}
            <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8 p-8 overflow-y-auto scrollbar-hide pb-32 pointer-events-auto">

                {/*  COL 1: BEHAVIOR & LOGIC */}
                <div className="space-y-8">
                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Sparkles size={18} className="text-purple-400" />
                            <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Behavioral Matrix</span>
                        </div>
                        <div className="space-y-3 h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                            {MODES.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => handleModeChange(m.id)}
                                    className={`group relative p-5 rounded-3xl border transition-all flex items-center gap-4 w-full ${currentMode === m.id ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.15)]' : 'bg-black/20 border-white/5 hover:border-white/20'}`}
                                >
                                    <span className="text-2xl">{m.icon}</span>
                                    <div className="text-left">
                                        <h3 className={`text-sm font-bold ${currentMode === m.id ? 'text-white' : 'text-white/40'}`}>{m.label}</h3>
                                        <p className="text-[10px] text-white/20 uppercase tracking-tighter">{m.desc}</p>
                                    </div>
                                    {currentMode === m.id && <Check size={18} className="absolute right-5 text-purple-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Cpu size={18} className="text-blue-400" />
                            <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Core Intelligence</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {['local', 'cloud'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => { setProvider(p); syncWithBackend('provider', p); }} // LlmRouterService local/cloud switch karega
                                    className={`p-5 rounded-3xl border transition-all flex flex-col items-center gap-3 ${provider === p ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'bg-black/20 border-white/5 text-white/20'}`}
                                >
                                    {p === 'local' ? <Server size={24} /> : <Wifi size={24} />}
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">{p}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/*  COL 2: AVATAR REPOSITORY (Logic Applied) */}
                <div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl h-full flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <Database size={18} className="text-emerald-400" />
                            <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Avatar Repository</span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 scrollbar-hide">
                            {characters && characters.map((char: any, idx: number) => (
                                <motion.div
                                    key={idx}
                                    onClick={() => setActiveCharacter(idx)}
                                    className={`relative p-5 rounded-[28px] border transition-all cursor-pointer flex items-center justify-between ${activeCharacterIndex === idx ? 'bg-emerald-600/10 border-emerald-500 shadow-[0_0_30px_rgba(52,211,153,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeCharacterIndex === idx ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                                            <FileCode size={24} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{char.name}</span>
                                            <span className="text-[9px] text-white/30 uppercase tracking-tight">VRM Model</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Active Indicator */}
                                        {activeCharacterIndex === idx && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />}

                                        {/*  DELETE BUTTON (Only for custom chars, idx > 0) */}
                                        {idx > 0 && (
                                            <motion.button
                                                whileHover={{ scale: 1.1, color: '#ef4444' }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={(e) => handleDeleteCharacter(e, idx)}
                                                className="p-2 rounded-xl hover:bg-red-500/10 text-white/20 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </motion.button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full p-6 rounded-[28px] border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-3 hover:bg-white/10 hover:border-white/20 transition-all shrink-0"
                            >
                                <Plus size={24} className="text-white/40" />
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Load New Avatar File</span>
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleCharacterImport} accept=".vrm" className="hidden" />
                        </div>
                    </div>
                </div>

                {/*  COL 3: ACOUSTIC & KEYS (Logic Applied) */}
                <div className="space-y-8">
                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Volume2 size={18} className="text-pink-400" />
                            <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Voice</span>
                        </div>

                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'af_sky', label: 'Sky (Breezy)' },
                                    { id: 'af_nicole', label: 'Nicole (Deep)' },
                                    { id: 'af_sarah', label: 'Sarah (Soft)' },
                                    { id: 'bf_isabella', label: 'Isabella (Goth)' },
                                    { id: 'af_kore', label: 'Kore (Dark)' },
                                    { id: 'af_bella', label: 'Bella (Pro)' }
                                ].map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => handleVoiceChange(v.id)}
                                        className={`p-4 rounded-2xl text-[10px] font-black border transition-all ${currentVoice === v.id ? 'bg-pink-600/20 border-pink-500 text-pink-300' : 'bg-black/40 border-white/5 text-white/30 hover:border-white/10'}`}
                                    >
                                        {v.label.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <div className="flex justify-between items-center text-[10px] text-white/30 font-black uppercase">
                                    <span>Gain Control</span>
                                    <span className="text-pink-400">{volume}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100" value={volume}
                                    onChange={(e) => setVolume(Number(e.target.value))}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-pink-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Shield size={18} className="text-orange-400" />
                                <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Encrypted Access</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Activity size={12} className={keyStatus?.status === 'ready' ? 'text-emerald-400 animate-pulse' : 'text-white/20'} />
                                <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{keyStatus?.mode || 'OFFLINE'}</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Groq Key Field */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                                        Groq Protocol
                                        {keyStatus?.groq?.available && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />}
                                    </span>
                                    <span className="text-[9px] text-white/20 uppercase font-bold italic">{keyStatus?.groq?.source === 'frontend' ? 'Session' : 'System'}</span>
                                </div>
                                <div className="relative group">
                                    <input
                                        type={showGroq ? "text" : "password"}
                                        value={keys.groq}
                                        onChange={(e) => setKeys({...keys, groq: e.target.value})}
                                        placeholder="Enter Groq Key..."
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-white placeholder-white/10 focus:border-orange-500/50 outline-none transition-all group-hover:border-white/10"
                                    />
                                    <button 
                                        onClick={() => setShowGroq(!showGroq)}
                                        className="absolute right-4 top-4 text-white/20 hover:text-white/50 transition-colors"
                                    >
                                        {showGroq ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Gemini Key Field */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                                        Gemini Matrix
                                        {keyStatus?.gemini?.available && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />}
                                    </span>
                                    <span className="text-[9px] text-white/20 uppercase font-bold italic">{keyStatus?.gemini?.source === 'frontend' ? 'Session' : 'System'}</span>
                                </div>
                                <div className="relative group">
                                    <input
                                        type={showGemini ? "text" : "password"}
                                        value={keys.gemini}
                                        onChange={(e) => setKeys({...keys, gemini: e.target.value})}
                                        placeholder="Enter Gemini Key..."
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-white placeholder-white/10 focus:border-blue-500/50 outline-none transition-all group-hover:border-white/10"
                                    />
                                    <button 
                                        onClick={() => setShowGemini(!showGemini)}
                                        className="absolute right-4 top-4 text-white/20 hover:text-white/50 transition-colors"
                                    >
                                        {showGemini ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={handleUpdateKeys}
                                    disabled={updateStatus === 'PENDING'}
                                    className={`flex items-center justify-center gap-2 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        updateStatus === 'SUCCESS' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                        updateStatus === 'ERROR' ? 'bg-red-500/20 border-red-500 text-red-400' :
                                        'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {updateStatus === 'PENDING' ? <RotateCcw size={14} className="animate-spin" /> : <Save size={14} />}
                                    {updateStatus === 'PENDING' ? 'Syncing...' : 'Update Keys'}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={handleClearKeys}
                                    className="flex items-center justify-center gap-2 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                                >
                                    <Trash2 size={14} />
                                    Clear
                                </motion.button>
                            </div>
                        </div>
                    </div>

                    {/*  SYSTEM DIAGNOSTICS */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Cpu size={18} className="text-cyan-400" />
                            <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Neural Diagnostics</span>
                        </div>

                        {/*  Cloud Sync Status */}
                        <div className="mt-8 pt-8 border-t border-white/5 w-full flex justify-center">
                            <button
                                onClick={runFullDiagnostics}
                                className={`px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 border ${testStatus === 'PENDING' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' :
                                    testStatus === 'SUCCESS' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                        testStatus === 'ERROR' ? 'bg-red-500/20 border-red-500 text-red-500' :
                                            'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {testStatus === 'PENDING' ? " SCANNING ECOSYSTEM..." :
                                    testStatus === 'SUCCESS' ? " ALL SYSTEMS NOMINAL" :
                                        testStatus === 'ERROR' ? " UPLINK CRITICAL FAILURE" :
                                            " RUN NEURAL DIAGNOSTICS"}
                            </button>
                        </div>

                        {/*  Cloud Sync Status */}
                        <div className="mt-8 pt-8 border-t border-white/5 w-full flex justify-center">
                            <button
                                onClick={() => {
                                    const unsynced = JSON.parse(localStorage.getItem('unsynced_history') || '[]');
                                    const pcOnline = (window as any).maeveAPI ? (window as any).maeveAPI.isPcOnline() : false;
                                    alert(` Cloud Sync Status:\n- Messages in queue: ${unsynced.length}\n- PC Online: ${pcOnline}\n- Keys: Groq=${store.apiKeys?.groq ? '' : ''}, Gemini=${store.apiKeys?.gemini ? '' : ''}`);
                                }}
                                className="px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all border bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                            >
                                 Check Cloud Sync Status
                            </button>
                        </div>

                        {/*  Manual Switch */}
                        <div className="mt-8 pt-8 border-t border-white/5 w-full flex justify-center">
                            <button
                                onClick={() => {
                                    // Force local mode override
                                    localStorage.setItem('force_local_mode', 'true');
                                    alert(" FORCE LOCAL MODE ACTIVATED\n\nMessages will route to PC regardless of heartbeat check.\nDisable by removing 'force_local_mode' from localStorage.");
                                }}
                                className="px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all border bg-orange-500/20 border-orange-500 text-orange-400 hover:bg-orange-500/30"
                            >
                                 FORCE LOCAL MODE
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/*  FOOTER STATUS */}
            <div className="fixed bottom-0 w-full p-5 bg-black/40 backdrop-blur-xl border-t border-white/5 flex justify-center gap-12">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    <span className="text-[10px] text-white/30 font-black tracking-[0.2em] uppercase">System Nominal</span>
                </div>
                <div className="flex items-center gap-3">
                    <Wifi size={14} className="text-blue-400" />
                    <span className="text-[10px] text-white/30 font-black tracking-[0.2em] uppercase italic">Uplink Synchronized</span>
                </div>
            </div>
        </div>
    );
};