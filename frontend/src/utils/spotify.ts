//  NOTE: Ye Backend se EXACT match hona chahiye
const REDIRECT_URI = "http://127.0.0.1:3001/callback";

const CLIENT_ID = "e1e782bf4bbc4aa48c46e51dcd1ca20c"; // Teri ID
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-read-currently-playing"
];

export const loginToSpotify = () => {
  //  Cache saaf karo taaki purana token na ude
  localStorage.removeItem('spotify_access_token');

  const url = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES.join("%20")}&response_type=code&show_dialog=true`;

  console.log(" Redirecting to Neural Link:", url);
  window.location.href = url;
};

export const getCodeFromUrl = () => {
  return new URLSearchParams(window.location.search).get('code');
};
