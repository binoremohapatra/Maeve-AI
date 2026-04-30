import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Briefcase, Heart, BookOpen, Sparkles, Trash2, Zap, ChevronDown, ChevronUp, Target, Clock } from 'lucide-react';
import { useMoodStore } from '../stores/moodStore';
import { useScreenSize } from '../hooks/useScreenSize';

export const MascotScheduleScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { schedule, addScheduleTask, removeScheduleTask, generateSmartSchedule } = useMoodStore();
  const { width } = useScreenSize();
  const [newTask, setNewTask] = useState("");
  const [selectedCat, setSelectedCat] = useState("WORK");
  const [isGenerating, setIsGenerating] = useState(false);
  
  //  Accordion State: Konsa task khula hai?
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const scaleFactor = Math.min(width / 1300, 1);

  return (
    <div className="absolute inset-0 z-50 flex flex-col pointer-events-none overflow-hidden">
      
      {/*  HEADER (Top-Left aligned for Cockpit feel) */}
      <motion.div style={{ scale: scaleFactor }} className="w-full pt-10 px-12 flex justify-start pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-full flex items-center gap-6 shadow-2xl">
          <button onClick={onBack} className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div className="text-left">
            <h1 className="text-xl font-black text-white uppercase tracking-tighter italic">Daily Planner</h1>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Maeve's Strict Routine Enabled</p>
          </div>
        </div>
      </motion.div>

      {/*  MIDDLE HUD PANELS */}
      <div className="flex-1 w-full px-12 flex items-center justify-between">
        
        {/* LEFT: NEURAL INPUT POOL (Task Entry) */}
        <motion.div style={{ scale: scaleFactor, transformOrigin: 'left center' }} className="w-[420px] pointer-events-auto space-y-4">
            <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                    <Target size={20} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">What are today's goals?</span>
                </div>
                
                <textarea 
                  value={newTask} 
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="e.g., I need to lose belly fat, study React for 2 hours, and clean my room..." 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500 transition-all resize-none h-24"
                />
                
                <div className="grid grid-cols-3 gap-2">
                    {[{id:'WORK', icon:Briefcase, label:'Tactical'}, {id:'HEALTH', icon:Heart, label:'Vital'}, {id:'LEARNING', icon:BookOpen, label:'Neural'}].map(cat => (
                        <button 
                          key={cat.id} 
                          onClick={() => setSelectedCat(cat.id)} 
                          className={`p-3 rounded-xl border text-[9px] font-bold uppercase transition-all ${selectedCat === cat.id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-transparent text-white/30 hover:bg-white/10'}`}
                        >
                            <cat.icon size={16} className="mb-1 mx-auto" />
                            {cat.label}
                        </button>
                    ))}
                </div>
                
                <button 
                  onClick={() => { 
                    if(newTask.trim()) {
                      addScheduleTask({id:Date.now().toString(), title:newTask, category:selectedCat as any, timeSlot:null, priorityScore:0, status:'pending'}); 
                      setNewTask(""); 
                    }
                  }} 
                  className="w-full bg-white/10 hover:bg-white/20 py-4 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest border border-white/10 transition-all"
                >
                  Add Custom Task
                </button>
            </div>

            <button 
              onClick={() => { 
                setIsGenerating(true); 
                generateSmartSchedule().then(() => setIsGenerating(false)); 
              }} 
              disabled={isGenerating} 
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 py-6 rounded-[30px] shadow-[0_0_30px_rgba(79,70,229,0.3)] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all group border border-white/10"
            >
                <Zap size={20} className={isGenerating ? 'animate-spin text-white' : 'text-yellow-300 group-hover:animate-bounce'} />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-white">
                  {isGenerating ? "Building Your Day..." : "Generate Full-Day Routine"}
                </span>
            </button>
        </motion.div>

        {/* RIGHT: TACTICAL TIMELINE (Today's Plan) */}
        <motion.div style={{ scale: scaleFactor, transformOrigin: 'right center' }} className="w-[460px] pointer-events-auto">
            <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[50px] p-8 shadow-2xl h-[75vh] flex flex-col">
                
                {/* Header for Timeline */}
                <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6 shrink-0">
                    <span className="text-[11px] font-black text-white/80 uppercase tracking-[0.3em]">Today's Master Itinerary</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/30 font-black tracking-widest shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                        {schedule.length} STEPS
                    </span>
                </div>

                {/* Scrollable Timeline Area */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar relative">
                    
                    {/*  EMPTY STATE: Jab schedule khali ho */}
                    {schedule.length === 0 && (
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-white/10 rounded-[30px] bg-white/5"
                        >
                            <Sparkles size={32} className="text-indigo-400 mb-4 opacity-50" />
                            <p className="text-white/60 text-sm font-bold tracking-wide mb-2">No active schedule.</p>
                            <p className="text-white/40 text-[10px] uppercase tracking-widest leading-relaxed">
                                Tell me your goals on the left, <br/>and let me build your perfect day.
                            </p>
                        </motion.div>
                    )}
                    
                    {/*  TIMELINE ITEMS */}
                    {schedule.map((task) => {
                        const isExpanded = expandedTaskId === task.id;
                        return (
                            <motion.div 
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                key={task.id} 
                                className="relative pl-8 border-l-2 border-white/10 py-1 group"
                            >
                                {/* Glowing Dot on Timeline */}
                                <div className="absolute -left-[5px] top-5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] transition-all group-hover:scale-150" />
                                
                                <div className={`border rounded-[28px] p-5 transition-all cursor-pointer ${isExpanded ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/[0.03] border-white/5 hover:bg-white/10'}`}>
                                    
                                    {/* Task Header - Click to Expand */}
                                    <div 
                                      className="flex justify-between items-center"
                                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                    >
                                        <div className="space-y-1.5 text-left pr-4">
                                            <p className="text-[10px] font-black uppercase flex items-center gap-1.5 text-emerald-400 tracking-widest">
                                                <Clock size={12} /> {task.timeSlot || "Scheduled"}
                                            </p>
                                            <h3 className="text-[14px] font-bold text-white/90 tracking-wide leading-tight">
                                                {task.title}
                                            </h3>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 shrink-0">
                                            {task.instruction && (
                                                <div className="p-2 rounded-full bg-white/5 text-white/40 group-hover:text-white transition-colors">
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </div>
                                            )}
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); removeScheduleTask(task.id); }} 
                                              className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/*  THE ACCORDION: Step-by-Step Instructions */}
                                    <AnimatePresence>
                                        {isExpanded && task.instruction && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }} 
                                                animate={{ height: "auto", opacity: 1 }} 
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-5 pt-5 border-t border-white/10">
                                                    <div className="flex items-start gap-3 bg-black/20 p-4 rounded-2xl">
                                                        <Sparkles size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                                                        <p className="text-[12px] text-white/70 leading-relaxed font-medium">
                                                            {task.instruction}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Complete Button */}
                                                    <button className="mt-4 w-full bg-emerald-500/10 border border-emerald-500/30 py-3.5 rounded-2xl text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all active:scale-95">
                                                        Mark as Completed
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
      </div>

      {/* Global Styles for Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
};