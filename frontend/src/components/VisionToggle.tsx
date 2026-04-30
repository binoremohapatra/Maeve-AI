import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface VisionToggleProps {
  className?: string;
}

export const VisionToggle: React.FC<VisionToggleProps> = ({ className = '' }) => {
  const [isVisionActive, setIsVisionActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize hidden elements once
  useEffect(() => {
    return () => {
      stopVision();
    };
  }, []);

  const sendFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Ensure video has actual dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg');

    try {
      // POST to backend
      const response = await fetch('/api/vision/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          userId: 'default_user_123', // Hardcoded for now as per instructions, can be dynamic later
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Vision context:", data.context);
      } else {
        console.error("Failed to send vision frame. Status:", response.status);
      }
    } catch (error) {
      console.error("Error sending vision frame:", error);
    }
  };

  const startVision = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready before starting interval
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          // Send first frame immediately
          sendFrame();
          // Then every 5 seconds
          intervalRef.current = setInterval(sendFrame, 5000);
          setIsVisionActive(true);
        };
      }
    } catch (error) {
      console.error("Camera permission denied or error:", error);
      setIsVisionActive(false);
    }
  };

  const stopVision = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsVisionActive(false);
  };

  const handleToggle = () => {
    if (isVisionActive) {
      stopVision();
    } else {
      startVision();
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`relative active:scale-90 transition-all duration-300 w-10 h-10 sm:w-12 sm:h-12 md:w-14 sm:h-12 md:h-14 flex items-center justify-center rounded-full shrink-0 ${
          isVisionActive
            ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] border-green-400' 
            : 'bg-white/10 text-white/50 hover:bg-white/20 border-white/5'
        } ${className}`}
        title={isVisionActive ? "Disable Vision" : "Enable Vision"}
      >
        {isVisionActive ? (
          <Eye className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
      </button>

      {/* Hidden Vision Elements */}
      <div style={{ display: 'none' }} aria-hidden="true">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
      </div>
    </>
  );
};

export default VisionToggle;
