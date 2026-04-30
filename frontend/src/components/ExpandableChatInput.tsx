import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Mic, MessageSquareText, X, StopCircle } from 'lucide-react';
import { MascotAction } from '../services/api-client';
import { useMaeveStream } from '../hooks/useMaeveStream';
import { useMoodStore } from '../stores/moodStore';
import { maeveAPI } from '../services/api';
import VisionToggle from './VisionToggle';

interface ExpandableChatInputProps {
  onSendMessage: (message: string) => void;
  radialMenuComponent: React.ReactNode;
  onChatToggle: () => void;
  isChatOpen: boolean;
  isMobile: boolean;
}

const ExpandableChatInput: React.FC<ExpandableChatInputProps> = ({
  onSendMessage, radialMenuComponent, onChatToggle, isChatOpen, isMobile
}) => {
  const [val, setVal] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  //  Stealth Mic Controller
  const isUserActiveMicRef = useRef(false);

  const heightClass = "h-10 sm:h-12 md:h-14";
  const btnClass = `w-10 sm:w-12 md:w-14 ${heightClass} flex items-center justify-center rounded-full transition-all shrink-0`;
  const iconSizeClass = "w-5 h-5 sm:w-6 sm:h-6";

  const { sendMessage: streamSendMessage, isConnected: isStreamConnected, interrupt } = useMaeveStream();

  // Textarea Auto-Resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (val.length > 0) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
      }
    }
  }, [val]);

  const handleSend = async () => {
    const messageToSend = val.trim();
    if (!messageToSend) return;

    // 1. Loading State & UI Update
    (window as any).motionController?.play(MascotAction.THINKING);
    setVal('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    console.log(" SENDING DIRECT TEXT:", messageToSend);

    // 2. Add USER message to screen immediately
    useMoodStore.getState().sendMessage(messageToSend);

    const currentPersona = useMoodStore.getState().currentMode || "amadere";

    // 3. THE BULLETPROOF HTTP POST
    try {
      const store = useMoodStore.getState();
      const response = await maeveAPI.sendDirectChat(
        store.userId,
        messageToSend,
        currentPersona,
        store.visualVibe,
        store.apiKeys || {}
      );

      console.log(" Direct Chat Response:", response);

      //  THE FIX: Directly update the chatHistory array!
      const replyTimestamp = Date.now();

      const replyMsg = {
        id: `reply-${replyTimestamp}`,
        message: response.replyText || "...",
        sender: 'maeve',
        timestamp: replyTimestamp,
      };

      // Add to Chat History
      useMoodStore.setState({
        chatHistory: [...store.chatHistory, replyMsg]
      });

      // Update Mascot State (Animation & Audio)
      store.setMascotResponse({
        replyText: response.replyText,
        mascotAction: response.action || response.animation || "IDLE",
        emotion: response.emotion || "NEUTRAL",
        audioBase64: response.audioBase64
      });

    } catch (e) {
      console.error(" Direct Chat Failed!", e);
      useMoodStore.getState().setMascotResponse({
        replyText: "System glitch... my connection timed out.",
        mascotAction: "SAD",
        emotion: "SAD"
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    //  FIX: Check keyCode as fallback, and ignore IME composition
    if (e.nativeEvent.isComposing) return;

    if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
      e.preventDefault(); // Stop new line
      console.log(" Enter key detected!"); // Debug log
      handleSend();
    }
  };

  //  STEALTH MIC LOOP (Talks to Python Port 5004)
  const startStealthMic = async () => {
    if (!isUserActiveMicRef.current) return;

    try {
      // Hit Python Stealth Mic
      const res = await fetch('http://127.0.0.1:5004/listen');
      const data = await res.json();

      // If user is still recording and Python caught a sentence
      if (isUserActiveMicRef.current && data.status === 'success' && data.text) {
        (window as any).motionController?.play(MascotAction.THINKING);

        if (isStreamConnected) {
          if (useMoodStore.getState().isStreaming) interrupt();
          streamSendMessage(data.text);
        } else {
          onSendMessage(data.text);
        }
      }

      // � The Loop: Keep listening automatically until user presses Stop
      if (isUserActiveMicRef.current) {
        startStealthMic();
      }
    } catch (err) {
      console.error(" Python Stealth Mic is offline! Start stealth_mic.py");
      setIsRecording(false);
      isUserActiveMicRef.current = false;
    }
  };

  //  ON/OFF SWITCH
  const toggleRecording = () => {
    if (isRecording) {
      // TURN OFF
      isUserActiveMicRef.current = false;
      setIsRecording(false);
    } else {
      // TURN ON
      isUserActiveMicRef.current = true;
      setIsRecording(true);
      startStealthMic(); // Trigger the Python listener loop
    }
  };

  return (
    <div className="flex justify-center w-full pointer-events-auto px-2 pb-4 md:pb-6">
      <motion.div
        layout
        className={`
            flex items-end gap-1.5 md:gap-3
            bg-white/[0.05] backdrop-blur-[50px] border border-white/10 
            shadow-2xl transition-all duration-300
            w-[96%] sm:w-[85%] md:w-[75%] lg:w-[60%] xl:w-[50%]
            rounded-[35px] md:rounded-[50px] p-1.5 md:p-2.5
            ${isRecording ? 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : ''}
        `}
      >
        <div className="flex items-center gap-1.5 md:gap-2 pb-0.5 pl-0.5 md:pl-1 shrink-0">
          <div className={`${btnClass} bg-white/5 border border-white/5 hover:bg-white/10 overflow-hidden`}>
            <div className="scale-75 flex items-center justify-center w-full h-full origin-center">
              {radialMenuComponent}
            </div>
          </div>

          {isMobile && (
            <button onClick={onChatToggle} className={`${btnClass} active:scale-95 border border-white/5`}>
              {isChatOpen ? <X className={iconSizeClass} /> : <MessageSquareText className={iconSizeClass} />}
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 pb-0.5">
          <div className={`relative bg-white/5 border border-white/5 rounded-[30px] flex items-center px-4 mx-1 transition-all min-${heightClass}`}>
            <textarea
              ref={textareaRef}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Stealth Mic Active... (Speak freely)" : "Message Maeve..."}
              rows={1}
              className="w-full bg-transparent border-none outline-none font-medium text-white placeholder-white/30 resize-none py-3 [&::-webkit-scrollbar]:hidden"
              style={{ maxHeight: '150px' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 pb-0.5 pr-0.5 md:pr-1 shrink-0">
          <VisionToggle />
          {/*  THE STEALTH MIC BUTTON */}
          <button
            onClick={toggleRecording}
            className={`relative ${btnClass} active:scale-90 transition-all duration-300 ${isRecording
              ? 'bg-red-500 text-white shadow-lg'
              : 'bg-white/10 text-white/50 hover:bg-white/20'
              }`}
          >
            {isRecording && <span className="absolute -inset-1 rounded-full border-2 border-red-400/50 animate-ping opacity-75"></span>}
            {isRecording ? <StopCircle className={iconSizeClass} /> : <Mic className={iconSizeClass} />}
          </button>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            data-dodge="true"
            onClick={(e) => {
              e.preventDefault(); //  Prevent any form submission issues
              console.log(" Send Button Clicked!");
              handleSend();
            }}
            disabled={isRecording || !val.trim()}
            className={`${btnClass} bg-white/10 text-white/90 border border-white/10 backdrop-blur-md hover:bg-white/20`}
          >
            <ArrowUp className={iconSizeClass} strokeWidth={2.5} />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ExpandableChatInput;
