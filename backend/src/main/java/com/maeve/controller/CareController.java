package com.maeve.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/care")
public class CareController {

    // Python Server URL
    private final String PYTHON_API_URL = "http://localhost:5000/process";

    @PostMapping("/{userId}/interact")
    public ResponseEntity<Map<String, Object>> handleInteraction(
            @PathVariable String userId,
            @RequestBody Map<String, String> payload) {
        
        // Payload Example: { "type": "action", "category": "love" }
        // Payload Example: { "type": "vent", "text": "I am sad" }
        
        try {
            // 1. Call Python AI
            RestTemplate restTemplate = new RestTemplate();
            Map<String, Object> pythonResponse = restTemplate.postForObject(PYTHON_API_URL, payload, Map.class);
            
            // 2. Return AI Response to Frontend
            return ResponseEntity.ok(pythonResponse);
            
        } catch (Exception e) {
            // Fallback agar Python band hai
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("replyText", "Brain not connected...");
            fallback.put("mascotAction", "SAD");
            fallback.put("emotion", "SAD");
            return ResponseEntity.ok(fallback);
        }
    }
}
