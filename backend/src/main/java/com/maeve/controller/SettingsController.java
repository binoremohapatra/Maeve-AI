package com.maeve.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import com.maeve.service.FirebaseSyncService;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
// 🔥 Remove @CrossOrigin to use global config
public class SettingsController {

    @Autowired
    private FirebaseSyncService firebaseSync;

    private final String PYTHON_BRAIN_URL = "http://localhost:5000/api/settings/sync";

    @PostMapping("/{userId}/update")
    public ResponseEntity<?> updateSettings(@PathVariable String userId, @RequestBody Map<String, Object> settings) {
        try {
            // 1. Save to Firebase for persistence
            // 'preferences' map ke andar settings dal do
            firebaseSync.updateUserProfile(userId, settings);

            // 2. Notify Python Brain immediately
            RestTemplate restTemplate = new RestTemplate();
            settings.put("userId", userId);
            restTemplate.postForObject(PYTHON_BRAIN_URL, settings, Map.class);

            return ResponseEntity.ok(Map.of("status", "Neural Link Updated"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }
}
