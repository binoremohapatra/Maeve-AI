import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMoodStore } from '../stores/moodStore';
import { Target, Zap, Clock, Activity, Cpu, Cloud, BatteryCharging } from 'lucide-react';
import { maeveAPI } from '../services/api';

interface Props {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const cleanText = (text: any): string => {
  if (!text) return '';
  let str = String(text);
  str = str.replace(/\[CONTEXT:.*?\]/gi, '');
  str = str.replace(/<<.*?>>/g, '');
  str = str.replace(/\*.*?\*/g, '');
  return str.trim();
};

/** Format a timestamp (ISO string or Date) → "10:42 AM" */
const formatTime = (ts: string | Date | undefined): string => {
  if (!ts) return '';
  try {
    const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// ─── Typing Indicator ───────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <motion.div
    key="typing-indicator"
    initial={{ y: 10, opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.95 }}
    className="flex w-full justify-start mb-5"
  >
    <div className="px-5 py-3.5 rounded-[26px] rounded-tl-none bg-purple-600/30 border border-purple-500/40 shadow-2xl backdrop-blur-3xl flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-2 h-2 rounded-full bg-purple-200"
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 0.7,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  </motion.div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export const AssistantSpeechDisplay: React.FC<Props> = ({ isMobileOpen }) => {
  const {
    schedule,
    chatHistory,
    isListeningMusic,
    lifeStats,
    provider,
    isStreaming,
    streamingText,
    mascot,
  } = useMoodStore();

  const [isPcLive, setIsPcLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  //  Real-time Heartbeat check for Neural Link
  useEffect(() => {
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkLink = async () => {
      if (!isActive) return;
      const status = await maeveAPI.isPcOnline();
      if (isActive) {
        setIsPcLive(status);
        timeoutId = setTimeout(checkLink, 5000);
      }
    };

    checkLink();
    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory.length, isStreaming, isMobileOpen]);

  const isActuallyLocal = isPcLive && provider === 'local';

  // ── Build a flat list of valid messages ──────────────────────────────────
  const validMessages = (chatHistory || []).filter((msg) => {
    const txt = cleanText(msg.message || msg.text || msg.content || msg.transcription || '');
    return txt.length > 0;
  });

  // ── Cluster logic WITH ORIGINAL INDEX HACK (This prevents the crash!) ──
  const clustered = validMessages.map((msg, i) => {
    const checkIsUser = (m: any) => {
      const s = String(m?.sender || m?.role || m?.author || m?.name || '').toLowerCase();
      // If it explicitly identifies as Maeve, System, AI, Bot, or Assistant -> NOT user (AI bubble)
      if (s.includes('maeve') || s.includes('system') || s === 'ai' || s === 'bot' || s === 'assistant') {
        return false;
      }
      // Otherwise, it's a User message (catches 'user', 'human', custom names like 'Binore', or missing fields)
      return true;
    };
    const senderIsUser = checkIsUser(msg);
    const prevSenderIsUser = i > 0 ? checkIsUser(validMessages[i - 1]) : null;
    const nextSenderIsUser = i < validMessages.length - 1 ? checkIsUser(validMessages[i + 1]) : null;

    const isFirst = senderIsUser !== prevSenderIsUser;
    const isLast = senderIsUser !== nextSenderIsUser;

    return { msg, isFirst, isLast, originalIndex: i, isUser: senderIsUser }; //  Storing real index
  });

  return (
    <div
      className={`
        flex flex-col pointer-events-none font-sans transition-all duration-500
        ${isMobileOpen
          ? 'w-full h-screen pt-20 pb-32 px-6 pointer-events-auto'
          : 'fixed left-10 top-28 bottom-36 w-[360px]'
        }
      `}
    >
      {/* ─── TODAY'S PLAN ─────────────────────────────────────────────────── */}
      <div className="mb-8 pointer-events-auto">
        <div className="flex items-center justify-between mb-4 ml-2">
          <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em]">Today's Plan</p>
          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-400">
            {schedule.filter((t) => t.status === 'pending').length} Tasks Pending
          </span>
        </div>

        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 invisible-scrollbar">
          {schedule.filter((t) => t.status === 'pending').map((task) => (
            <motion.div
              key={task.id}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-white/[0.04] backdrop-blur-3xl border border-white/5 p-4 rounded-[30px] shadow-2xl flex items-center justify-between group hover:bg-white/[0.08] hover:border-emerald-500/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                  <Target size={20} className="text-emerald-400/80" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-white/90 tracking-tight leading-none mb-1.5">
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Clock size={10} className="text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">
                      {task.timeSlot || 'Scheduled'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pr-2">
                <Zap
                  size={14}
                  className="text-yellow-400/30 group-hover:text-yellow-400 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] transition-all"
                />
              </div>
            </motion.div>
          ))}

          {schedule.filter((t) => t.status === 'pending').length === 0 && (
            <div className="text-center p-4 border border-dashed border-white/10 rounded-2xl bg-white/5">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                No plan for today. Open planner to generate.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── CHAT HISTORY ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 ml-2 mr-2">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em]">Chats</p>
            {isListeningMusic && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md"
              >
                <Activity size={10} className="text-emerald-400 animate-pulse" />
                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Ears Active</span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
              <BatteryCharging
                size={10}
                className={lifeStats.energy < 30 ? 'text-red-500 animate-pulse' : 'text-indigo-400'}
              />
              <span className="text-[9px] font-black text-white/40">{lifeStats.energy}%</span>
            </div>

            <div
              className={`
                flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border transition-all duration-500
                ${isActuallyLocal
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                }
              `}
            >
              {isActuallyLocal
                ? <Cpu size={10} className="animate-pulse" />
                : <Cloud size={10} className="animate-pulse" />}
              <span className="text-[8px] font-black uppercase tracking-widest">
                {isActuallyLocal ? 'Local' : 'Cloud'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Scrollable message list ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-3 pointer-events-auto invisible-scrollbar flex flex-col">
          {/*  FIX: Removed AnimatePresence completely. It causes memory leaks on long lists! */}
          {clustered.slice(-15).map(({ msg, isFirst, isLast, originalIndex, isUser }) => {
            const rawText = msg.message || msg.text || msg.content || msg.transcription || '';
            const txt = cleanText(rawText);
            if (!txt) return null;

            const isMaeve = !isUser;
            const timestamp = formatTime(msg.timestamp || msg.createdAt || msg.time);
            const tailClass = isFirst ? (isMaeve ? 'rounded-tl-none' : 'rounded-tr-none') : '';
            const marginBottom = isLast ? 'mb-5' : 'mb-1';

            return (
              <div
                // Fixed key strategy
                key={msg.id || `msg-safe-${originalIndex}`}
                className={`flex w-full ${isMaeve ? 'justify-start' : 'justify-end'} ${marginBottom}`}
                // Simple CSS animation instead of heavy Framer Motion
                style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}
              >
                <div
                  data-chat-message={isMaeve ? 'true' : undefined}
                  className={`
                    relative px-5 py-3.5 rounded-[26px] text-[13px] leading-relaxed
                    shadow-xl backdrop-blur-xl border transition-all
                    ${tailClass}
                    ${isMaeve
                      ? 'bg-purple-600/30 border-purple-500/40 text-purple-50 max-w-[85%]'
                      : 'bg-zinc-700/60 border-zinc-600/50 text-zinc-100 ml-10 max-w-[80%]'
                    }
                  `}
                >
                  <span>{txt}</span>
                  {timestamp && (
                    <span className={`block text-right text-[9px] mt-1.5 leading-none select-none ${isMaeve ? 'text-purple-300/60' : 'text-zinc-400'}`}>
                      {timestamp}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {mascot?.loading && !isStreaming && <TypingIndicator />}

          {isStreaming && streamingText && (
            <div
              key="streaming-msg"
              className="flex w-full justify-start mb-5"
              style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}
            >
              <div className="relative px-5 py-3.5 rounded-[26px] rounded-tl-none text-[13px] leading-relaxed shadow-xl backdrop-blur-xl border bg-purple-600/30 border-purple-500/40 text-purple-50 max-w-[85%]">
                {streamingText}
                <span className="inline-block w-1.5 h-4 bg-purple-200 ml-1 align-middle animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .invisible-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .invisible-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};