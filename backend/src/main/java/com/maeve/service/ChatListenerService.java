package com.maeve.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.database.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

@Service
public class ChatListenerService {

    @Autowired
    private FirebaseDatabase firebaseDatabase;

    private final RestTemplate restTemplate = new RestTemplate();
    private final String PYTHON_BRAIN_URL = (System.getenv("BRAIN_SERVICE_URL") != null ? System.getenv("BRAIN_SERVICE_URL") : "http://127.0.0.1:5000") + "/process"; // 🔥 Python Logic
    private final String USER_ID = "user_pro_01";

    @PostConstruct
    public void startChatListener() {
        System.out.println("🎧 HYBRID LISTENER STARTED: Delegating to Python Brain 🐍");
        
        DatabaseReference chatRef = firebaseDatabase.getReference("users/" + USER_ID + "/chats");

        chatRef.limitToLast(1).addChildEventListener(new ChildEventListener() {
            @Override
            public void onChildAdded(DataSnapshot snapshot, String previousChildName) {
                try {
                    Map<String, Object> msg = (Map<String, Object>) snapshot.getValue();
                    if (msg == null) return;

                    String sender = String.valueOf(msg.get("sender"));
                    String text = String.valueOf(msg.get("message"));
                    long timestamp = 0;
                    if(msg.get("timestamp") instanceof Long) timestamp = (Long) msg.get("timestamp");

                    // 1. Ignore Own Messages & Old Messages (>10s)
                    if ("maeve".equalsIgnoreCase(sender)) return;
                    if (System.currentTimeMillis() - timestamp > 10000) return;

                    System.out.println("📨 USER SAID: " + text);

                    // 2. 🔥 CALL PYTHON (Handles Memory + Emotion + Voice)
                    processWithPython(chatRef, text);

                } catch (Exception e) {
                    System.err.println("❌ Listener Error: " + e.getMessage());
                }
            }

            @Override public void onChildChanged(DataSnapshot s, String p) {}
            @Override public void onChildRemoved(DataSnapshot s) {}
            @Override public void onChildMoved(DataSnapshot s, String p) {}
            @Override public void onCancelled(DatabaseError e) {}
        });
    }

    private void processWithPython(DatabaseReference chatRef, String userText) {
        try {
            // Prepare Payload for Python
            Map<String, String> payload = new HashMap<>();
            payload.put("message", userText);
            payload.put("userId", USER_ID); // Identifies user for Memory file

            // Call Python API
            Map<String, Object> response = restTemplate.postForObject(PYTHON_BRAIN_URL, payload, Map.class);

            if (response != null) {
                String replyText = (String) response.get("replyText"); // Clean text from Python
                String audioBase64 = (String) response.get("audioBase64");
                String action = (String) response.get("mascotAction");
                String emotion = (String) response.get("emotion");

                System.out.println("🤖 BRAIN: " + replyText + " [" + emotion + "]");

                // 3. Save to Firebase (Clean)
                Map<String, Object> reply = new HashMap<>();
                reply.put("sender", "maeve");
                reply.put("message", replyText); // Clean Text Only!
                
                // 🔥 Injecting Tag for Frontend Animation Trigger
                // We append it nicely so 'moodStore' regex picks it up but cleaner removes it
                reply.put("message", "<<"+action+">> " + replyText); 
                
                reply.put("audioBase64", audioBase64);
                reply.put("timestamp", System.currentTimeMillis());
                
                chatRef.push().setValueAsync(reply);
            }

        } catch (Exception e) {
            System.err.println("❌ Python Brain Dead: " + e.getMessage());
            // Fallback Text if Python fails
            sendFallback(chatRef, "My brain is offline, darling.");
        }
    }

    private void sendFallback(DatabaseReference chatRef, String text) {
        Map<String, Object> reply = new HashMap<>();
        reply.put("sender", "maeve");
        reply.put("message", text);
        reply.put("timestamp", System.currentTimeMillis());
        chatRef.push().setValueAsync(reply);
    }
}
