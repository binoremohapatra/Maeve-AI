import { useEffect, useRef, useState } from 'react';
import { useMoodStore } from '../stores/moodStore';
import { Eye, EyeOff } from 'lucide-react';
import { API_ENDPOINTS } from '../config/EcosystemConfig';

export const VisionManager = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [visionStatus, setVisionStatus] = useState("Offline");
  const { setVisualVibe } = useMoodStore();

  // कैमरा और वेबसॉकेट टॉगल लॉजिक
  useEffect(() => {
    let interval: any;

    if (isCameraOn) {
      setVisionStatus("Connecting...");
      wsRef.current = new WebSocket(API_ENDPOINTS.VISION_WS);

      wsRef.current.onopen = () => {
        setVisionStatus("God-Mode Active ");
        console.log(" Vision WebSocket Connected");
      };

      wsRef.current.onclose = () => {
        setVisionStatus("Vision Offline ");
        console.log(" Vision WebSocket Disconnected");
      };

      wsRef.current.onerror = () => {
        setVisionStatus("Connection Error ");
        console.error(" Vision WebSocket Error");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.vibe) {
            console.log(" Maeve Sees:", data.vibe);
            setVisualVibe(data.vibe);
          }
        } catch (error) {
          console.error(" Error parsing vision data:", error);
        }
      };

      // कैमरा स्टार्ट करना
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            console.log(" Camera started successfully");
          }
        })
        .catch(err => {
          console.error("Camera Error:", err);
          setVisionStatus("Camera Error ");
        });

      // हर 3 सेकंड में frame भेजना
      interval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && videoRef.current && canvasRef.current) {
          const context = canvasRef.current.getContext('2d');
          if (context && videoRef.current.readyState === 4) { // HAVE_ENOUGH_DATA
            context.drawImage(videoRef.current, 0, 0, 320, 240);
            const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
            wsRef.current.send(JSON.stringify({ image: base64Image }));
          }
        }
      }, 3000);
    } else {
      // Cleanup: Turn off everything when disabled
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      setVisionStatus("Privacy Mode ");
    }

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isCameraOn]); //  setVisualVibe Hata diya! Ab camera crash nahi hoga.

  return (
    <div className="absolute top-4 left-4 z-50 flex items-center gap-3 pointer-events-auto">
      {/*  Toggle Button */}
      <button
        onClick={() => setIsCameraOn(!isCameraOn)}
        className={`p-3 rounded-full backdrop-blur-md border transition-all ${isCameraOn
            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 hover:bg-cyan-500/30'
            : 'bg-white/5 border-white/20 text-white/50 hover:bg-white/10'
          }`}
      >
        {isCameraOn ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>

      {/*  Status Badge */}
      <div className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full transition-colors ${isCameraOn
            ? 'bg-cyan-400 animate-pulse'
            : visionStatus.includes('Error')
              ? 'bg-red-500'
              : 'bg-gray-500'
          }`} />
        <span className="text-[10px] text-cyan-400 font-bold tracking-widest whitespace-nowrap">
          {visionStatus}
        </span>
      </div>

      {/* Hidden elements for processing */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />
    </div>
  );
};
