package com.maeve.service;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.Map;

@Service
public class VoiceService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String TTS_SERVER_URL = (System.getenv("BRAIN_SERVICE_URL") != null ? System.getenv("BRAIN_SERVICE_URL") : "http://127.0.0.1:5000") + "/generate";

    /**
     * Overloaded method for backward compatibility
     * @param text The text to speak
     */
    public String generateAudio(String text) {
        return generateAudio(text, "NEUTRAL"); // Khud se NEUTRAL bhej dega
    }

    /**
     * Main method with mood support
     * @param text The text to speak
     * @param mood Optional: "HAPPY", "SAD", "SEXY", "ANGRY" (Extracted from parser)
     */
    public String generateAudio(String text, String mood) {
        try {
            String cleanText = text.replaceAll("<<.*?>>", "").trim();
            if (cleanText.isEmpty()) return null;

            // Kokoro server (Python) ka URL
            String url = (System.getenv("BRAIN_SERVICE_URL") != null ? System.getenv("BRAIN_SERVICE_URL") : "http://127.0.0.1:5000") + "/generate";

            // JSON Payload: text aur mood dono bhej rahe hain
            Map<String, String> requestBody = Map.of(
                "text", cleanText,
                "mood", (mood != null) ? mood : "NEUTRAL"
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (String) response.getBody().get("audio_base64");
            }
        } catch (Exception e) {
            System.err.println("❌ Java-Python Connection Error: " + e.getMessage());
        }
        return null;
    }
}
