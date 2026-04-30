import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMoodStore } from '../stores/moodStore';
import { API_ENDPOINTS } from '../config/EcosystemConfig';

export const Callback = () => {
  const navigate = useNavigate();
  const called = useRef(false); //  Guard: Dobara call hone se rokega
  const { setSpotifyToken } = useMoodStore();

  useEffect(() => {
    if (called.current) return;

    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      called.current = true;
      console.log(" Establishing Neural Link...");
      
      fetch(`${API_ENDPOINTS.JAVA_CORE}/api/spotify/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          console.log(" Neural Link Established!");
          localStorage.setItem('spotify_access_token', data.access_token);
          setSpotifyToken(data.access_token);
          navigate('/'); // Sync hone ke baad wapas home
        }
      })
      .catch(err => console.error(" Neural Link Failed:", err));
    }
  }, [navigate, setSpotifyToken]);

  return (
    <div className="h-screen bg-[#080810] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-green-500 font-mono text-lg animate-pulse">ESTABLISHING NEURAL LINK...</p>
      </div>
    </div>
  );
};
