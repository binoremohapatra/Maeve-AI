package com.maeve.service;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.maeve.model.Task;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class FirebaseSyncService {

    @Autowired
    private FirebaseDatabase firebaseDatabase;

    // ✅ FIXED: Unified User ID for all services
    private String userId = "user_pro_01"; 

    public void saveChatMessage(String sender, String text, String emotion) {
        try {
            String messageId = "msg_" + System.currentTimeMillis();
            String chatPath = "users/" + userId + "/chats/" + messageId;
            
            Map<String, Object> message = new HashMap<>();
            message.put("sender", sender);
            message.put("message", text); // ✅ FIXED: Changed 'text' to 'message' to prevent Frontend Crash
            message.put("emotion", emotion != null ? emotion : "NEUTRAL");
            message.put("timestamp", System.currentTimeMillis()); // ms for JS Date
            
            firebaseDatabase.getReference(chatPath).setValueAsync(message);
            log.info("💬 [Firebase] Chat Synced: {} -> {}", sender, text);
        } catch (Exception e) {
            log.error("❌ Failed to sync chat: {}", e.getMessage());
        }
    }

    // 🧠 NEW: Reward System Persistence
    public void saveNeuralPoints(int points) {
        try {
            firebaseDatabase.getReference("users/" + userId + "/neuralPoints").setValueAsync(points);
            log.info("🧠 [Firebase] Neural Points Updated: {}", points);
        } catch (Exception e) {
            log.error("❌ Neural Points Sync Failed: {}", e.getMessage());
        }
    }

    public void saveScheduleToFirebase(List<Task> schedule) {
        try {
            String date = java.time.LocalDate.now().toString();
            String path = "users/" + userId + "/schedule/" + date;
            firebaseDatabase.getReference(path).setValueAsync(schedule);
            log.info("📅 [Firebase] Strategic Plan Synced: {} tasks", schedule.size());
        } catch (Exception e) {
            log.error("❌ Failed to save schedule: {}", e.getMessage());
        }
    }

    public void setActiveSession(String provider, String device) {
        try {
            String sessionPath = "users/" + userId + "/active_session";
            
            Map<String, Object> session = new HashMap<>();
            session.put("provider", provider);
            session.put("device", device);
            session.put("last_active", System.currentTimeMillis() / 1000);
            
            DatabaseReference sessionRef = firebaseDatabase.getReference(sessionPath);
            
            // Simple async call without callback
            sessionRef.setValueAsync(session);
            
            log.info("📱 Active session updated: {} on {}", provider, device);
            System.out.println("📱 Session updated: " + provider + " on " + device);
            
        } catch (Exception e) {
            log.error("Failed to update session: {}", e.getMessage());
            System.err.println("❌ Failed to update session: " + e.getMessage());
        }
    }

    public void sendCommand(String action, String payload) {
        try {
            String commandId = "cmd_" + System.currentTimeMillis();
            String commandPath = "users/" + userId + "/commands/" + commandId;
            
            Map<String, Object> command = new HashMap<>();
            command.put("action", action);
            command.put("payload", payload);
            command.put("status", "PENDING");
            command.put("timestamp", System.currentTimeMillis() / 1000);
            
            DatabaseReference commandRef = firebaseDatabase.getReference(commandPath);
            
            // Simple async call without callback
            commandRef.setValueAsync(command);
            
            log.info("📤 Command sent to Firebase: {} -> {}", action, payload);
            System.out.println("📤 Command sent: " + action + " -> " + payload);
            
        } catch (Exception e) {
            log.error("Failed to send command: {}", e.getMessage());
            System.err.println("❌ Failed to send command: " + e.getMessage());
        }
    }

    public void updateUserProfile(String userId, Map<String, Object> settings) {
        try {
            String profilePath = "users/" + userId + "/preferences";
            
            Map<String, Object> preferences = new HashMap<>();
            preferences.putAll(settings);
            preferences.put("updated_at", System.currentTimeMillis() / 1000);
            
            DatabaseReference profileRef = firebaseDatabase.getReference(profilePath);
            
            // Simple async call without callback
            profileRef.setValueAsync(preferences);
            
            log.info("⚙️ User preferences updated for: {}", userId);
            System.out.println("⚙️ Preferences updated: " + userId);
            
        } catch (Exception e) {
            log.error("Failed to update preferences: {}", e.getMessage());
            System.err.println("❌ Failed to update preferences: " + e.getMessage());
        }
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
