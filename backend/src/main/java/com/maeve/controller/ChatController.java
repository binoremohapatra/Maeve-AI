package com.maeve.controller;

import com.maeve.model.ChatRequest;
import com.maeve.model.ChatResponse;
import com.maeve.service.FirebaseSyncService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@Slf4j
public class ChatController {

    @Autowired
    private FirebaseSyncService firebaseSyncService;

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        long startTime = System.currentTimeMillis();

        try {
            // 1. Firebase Sync - User Message
            firebaseSyncService.saveChatMessage("user", request.getMessage(), "NEUTRAL");
            firebaseSyncService.setActiveSession("LOCAL_PC", request.getDeviceId());

            // 2. 🔥 CALL PYTHON GOD-BRAIN (Instead of direct Ollama)
            RestTemplate restTemplate = new RestTemplate();
            Map<String, Object> pythonPayload = new HashMap<>();
            pythonPayload.put("message", request.getMessage());
            pythonPayload.put("userId", request.getUserId());
            pythonPayload.put("isPremium", true);

            // POST to Python
            Map<String, Object> pythonResponse = restTemplate.postForObject(
                "http://127.0.0.1:5000/process", 
                pythonPayload, 
                Map.class
            );

            // 3. Extract Python Output
            String replyText = (String) pythonResponse.getOrDefault("replyText", "Brain error");
            String action = (String) pythonResponse.getOrDefault("mascotAction", "IDLE");
            String emotion = (String) pythonResponse.getOrDefault("emotion", "NEUTRAL");
            String audioBase64 = (String) pythonResponse.get("audioBase64");

            // 4. Firebase Sync - Maeve Message
            firebaseSyncService.saveChatMessage("maeve", replyText, emotion);

            // 5. Build Java Response for Frontend
            ChatResponse response = new ChatResponse();
            response.setReply(replyText);
            response.setAction(action);
            response.setExpression(emotion);
            response.setAudioBase64(audioBase64);
            response.setMode("HYBRID_GOD_MODE");
            response.setResponseTime(System.currentTimeMillis() - startTime);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Python Brain Connection Error: ", e);
            ChatResponse errorRes = new ChatResponse();
            errorRes.setReply("My neural link to the Python Brain dropped, darling.");
            errorRes.setExpression("SAD");
            return ResponseEntity.ok(errorRes);
        }
    }
}
