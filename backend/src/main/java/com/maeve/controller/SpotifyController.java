package com.maeve.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@RestController
@RequestMapping("/api/spotify")
@CrossOrigin(origins = "http://localhost:5173") // Ensure this matches your Frontend Port
public class SpotifyController {

    @Value("${spotify.client.id}")
    private String clientId;

    @Value("${spotify.client.secret}")
    private String clientSecret;

    @Value("${lastfm.api.key}")
    private String lastfmApiKey;

    @Value("${lastfm.api.secret}")
    private String lastFmSecret;

    @Value("${spotify.client.redirect-uri}")
    private String redirectUri;

    private final RestTemplate restTemplate = new RestTemplate();
    private final Random random = new Random();

    // 🔥 TERE SARE 9 DANCE MOVES YAHAN REGISTER KAR DIYE
    private static final String[] ALL_DANCE_MOVES = {
        "DANCE_HAPPY", "DANCE_COOL", "DANCE_SEXY", 
        "DANCE_BOOTY", "DANCE_HH_VAR", "DANCE_HIPHOP", 
        "DANCE_SABA", "DANCE_SOUL", "DANCE_ROBOT"
    };

    @PostMapping("/token")
    public ResponseEntity<?> getAccessToken(@RequestBody Map<String, String> payload) {
        try {
            String code = payload.get("code");

            // 1. TOKEN URL (Yeh Accounts server hai)
           String tokenUrl = "https://accounts.spotify.com/api/token";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            String auth = clientId + ":" + clientSecret;
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.US_ASCII));
            headers.set("Authorization", "Basic " + encodedAuth);

            MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
            map.add("grant_type", "authorization_code");
            map.add("code", code);
            map.add("redirect_uri", redirectUri);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(map, headers);

            try {
                ResponseEntity<Map> response = restTemplate.postForEntity(tokenUrl, request, Map.class);
                return ResponseEntity.ok(response.getBody());
            } catch (HttpClientErrorException e) {
                System.err.println("❌ Spotify Auth Error: " + e.getResponseBodyAsString());
                return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/search")
    public ResponseEntity<?> searchTracks(@RequestBody Map<String, String> payload) {
        try {
            String query = payload.get("query");
            String accessToken = payload.get("access_token");

            if (query == null) return ResponseEntity.badRequest().body("Query missing");

            // 2. SEARCH URL
           String searchUrl = "https://api.spotify.com/v1/search?q=" + 
                   java.net.URLEncoder.encode(query, StandardCharsets.UTF_8) + 
                   "&type=track&limit=10";

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            HttpEntity<String> request = new HttpEntity<>(headers);

            try {
                ResponseEntity<Map> response = restTemplate.exchange(searchUrl, HttpMethod.GET, request, Map.class);
                return ResponseEntity.ok(response.getBody());
            } catch (HttpClientErrorException e) {
                return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }

    @PostMapping("/audio-features")
    public ResponseEntity<?> getAudioFeatures(@RequestBody Map<String, String> payload) {
        try {
            String trackId = payload.get("track_id");
            String token = payload.get("access_token");

            // 🛑 DEBUGGING LOGS (Console me check karna)
            System.out.println("\n🔍 --- DEBUGGING AUDIO FEATURES ---");
            System.out.println("📥 Received Track ID: " + trackId);
            System.out.println("🔑 Received Token: " + (token != null ? token.substring(0, Math.min(10, token.length())) + "..." : "NULL"));

            if (trackId == null || token == null) {
                System.out.println("❌ ERROR: Missing Data");
                return ResponseEntity.badRequest().body("Missing data");
            }

            // ID Cleaning
            if (trackId.contains(":")) {
                trackId = trackId.substring(trackId.lastIndexOf(":") + 1);
            }

            // ✅ OFFICIAL SPOTIFY ENDPOINT (HTTPS)
            String url = "https://api.spotify.com/v1/audio-features/" + trackId;

            System.out.println("🌐 Hitting URL: " + url);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + token);
            HttpEntity<String> request = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);
            
            System.out.println("✅ Spotify Response: " + response.getStatusCode());
            return ResponseEntity.ok(response.getBody());

        } catch (HttpClientErrorException e) {
            System.err.println("❌ Spotify API Error: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }

    private String determineDanceStyle(double tempo, double energy, double danceability, double valence) {
        // High Energy & Fast Tempo (120+ BPM)
        if (tempo > 120 && energy > 0.7) {
            if (danceability > 0.8) return "DANCE_HAPPY";
            if (valence > 0.8) return "DANCE_BOOTY";
            return "DANCE_HIPHOP";
        }
        
        // Medium Energy & Rhythmic
        if (energy > 0.5 && danceability > 0.6) {
            if (tempo > 100) return "DANCE_COOL";
            return "DANCE_HH_VAR";
        }
        
        // Low Energy & Smooth
        if (energy < 0.5 && valence < 0.5) {
            return "DANCE_SEXY";
        }
        
        // Soulful & Groovy
        if (valence > 0.6 && danceability > 0.7) {
            return "DANCE_SOUL";
        }
        
        // Unique/Experimental
        if (tempo < 90 && energy > 0.4) {
            return "DANCE_ROBOT";
        }
        
        // Default fallback
        if (danceability > 0.7) return "DANCE_SABA";
        
        return "DANCE_HAPPY";
    }

    @PostMapping("/get-mood-external")
    public ResponseEntity<?> getMoodExternal(@RequestBody Map<String, String> payload) {
        try {
            String track = payload.get("song_name");
            String artist = payload.get("artist");
            String apiKey = lastfmApiKey;

            String url = "http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=" 
                         + apiKey + "&artist=" + artist + "&track=" + track + "&format=json";

            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            
            // 🔥 SMART LOGIC: API Response ko modify karke Dance Move inject karo
            Map<String, Object> responseBody = new HashMap<>();
            if (response.getBody() != null) {
                responseBody.putAll(response.getBody());
                
                // Tags nikalo aur Dance decide karo
                String smartDance = determineSmartDance(responseBody);
                responseBody.put("neural_dance", smartDance); // Frontend ke liye gift 🎁
                
                System.out.println("✅ Neural Decision for " + track + ": " + smartDance);
            }

            return ResponseEntity.ok(responseBody);

        } catch (Exception e) {
            System.err.println("❌ Neural Error: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Neural Backup Offline"));
        }
    }

    // 🧠 THE BRAIN: Tags ke hisab se dance choose karega
    private String determineSmartDance(Map<String, Object> lastFmData) {
        try {
            // Extract Tags securely
            Map track = (Map) lastFmData.get("track");
            Map topTags = (Map) track.get("toptags");
            List<Map<String, String>> tags = (List<Map<String, String>>) topTags.get("tag");

            for (Map<String, String> tagObj : tags) {
                String tag = tagObj.get("name").toLowerCase();

                // 🎵 Genre Mapping (Sare 9 Moves Cover Henge)
                if (tag.contains("hip-hop") || tag.contains("rap")) return "DANCE_HIPHOP";
                if (tag.contains("twerk") || tag.contains("sexy") || tag.contains("club")) return "DANCE_BOOTY";
                if (tag.contains("soul") || tag.contains("rnb") || tag.contains("slow")) return "DANCE_SOUL";
                if (tag.contains("latin") || tag.contains("salsa") || tag.contains("world")) return "DANCE_SABA";
                if (tag.contains("electronic") || tag.contains("techno") || tag.contains("robot")) return "DANCE_ROBOT";
                if (tag.contains("pop") || tag.contains("dance")) return "DANCE_HAPPY";
                if (tag.contains("chill") || tag.contains("cool")) return "DANCE_COOL";
            }
        } catch (Exception e) {
            // Agar tags parsing fail ho jaye, to ignore karo
        }

        // 🎲 FALLBACK: Agar koi tag match na ho, to RANDOM dance uthao
        // Isse ensure hoga ki sare dance kabhi na kabhi aayenge
        return ALL_DANCE_MOVES[random.nextInt(ALL_DANCE_MOVES.length)];
    }

    /**
     * 🔐 Future-ready: Creates MD5 signature for Last.fm write operations
     * Required for methods like track.love, track.scrobble, etc.
     */
    private String createLastFmSignature(Map<String, String> params) {
        try {
            // Sort parameters alphabetically
            List<String> keys = new ArrayList<>(params.keySet());
            Collections.sort(keys);
            
            // Build signature string
            StringBuilder signatureBuilder = new StringBuilder();
            for (String key : keys) {
                if (!"format".equals(key)) { // Don't include format in signature
                    signatureBuilder.append(key).append(params.get(key));
                }
            }
            signatureBuilder.append(lastFmSecret); // Append secret at the end
            
            // Create MD5 hash
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(signatureBuilder.toString().getBytes(StandardCharsets.UTF_8));
            
            // Convert to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
        } catch (Exception e) {
            System.err.println("❌ Signature creation failed: " + e.getMessage());
            return null;
        }
    }
}