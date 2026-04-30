package com.maeve.service;

import com.google.firebase.database.DatabaseReference;
import com.maeve.model.ChatRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Firebase service for real-time synchronization across devices.
 * Handles chat history, device presence, and media casting.
 */
@Service
@Slf4j
public class FirebaseService {
    
    private final DatabaseReference chatsReference;
    private final DatabaseReference presenceReference;
    private final DatabaseReference mediaReference;
    
    @Autowired
    public FirebaseService(DatabaseReference chatsReference, 
                        DatabaseReference presenceReference, 
                        DatabaseReference mediaReference) {
        this.chatsReference = chatsReference;
        this.presenceReference = presenceReference;
        this.mediaReference = mediaReference;
    }
    
    /**
     * Saves a user message to Firebase for synchronization.
     * Asynchronously pushes to /users/{userId}/chats node.
     * 
     * @param userId User identifier
     * @param message Chat message to save
     */
    public CompletableFuture<Void> saveMessage(String userId, ChatRequest message) {
        log.debug("Saving message for user: {}", userId);
        
        return CompletableFuture.runAsync(() -> {
            try {
                DatabaseReference userChatsRef = chatsReference.child(userId).child("chats");
                
                // Create message object with metadata
                Map<String, Object> messageData = Map.of(
                    "message", message.getMessage(),
                    "mode", message.getMode().name(),
                    "deviceId", "unknown", // Will be updated by controller
                    "timestamp", System.currentTimeMillis(),
                    "type", "user"
                );
                
                userChatsRef.push().setValueAsync(messageData);
                log.debug("Message saved to Firebase for user: {}", userId);
                
            } catch (Exception e) {
                log.error("Failed to save message to Firebase: {}", e.getMessage(), e);
            }
        });
    }
    
    /**
     * Saves an AI response to Firebase for synchronization.
     * Asynchronously pushes to /users/{userId}/chats node.
     * 
     * @param userId User identifier
     * @param response AI response to save
     * @param provider Provider that generated the response
     */
    public CompletableFuture<Void> saveResponse(String userId, String response, String provider, String mode) {
        log.debug("Saving response for user: {} from provider: {}", userId, provider);
        
        return CompletableFuture.runAsync(() -> {
            try {
                DatabaseReference userChatsRef = chatsReference.child(userId).child("chats");
                
                // Create response object with metadata
                Map<String, Object> responseData = Map.of(
                    "message", response,
                    "provider", provider,
                    "mode", mode,
                    "deviceId", "server", // Server-generated response
                    "timestamp", System.currentTimeMillis(),
                    "type", "ai"
                );
                
                userChatsRef.push().setValueAsync(responseData);
                log.debug("Response saved to Firebase for user: {}", userId);
                
            } catch (Exception e) {
                log.error("Failed to save response to Firebase: {}", e.getMessage(), e);
            }
        });
    }
    
    /**
     * Updates the active device for a user.
     * Used for device switching and presence management.
     * 
     * @param userId User identifier
     * @param deviceId Device identifier
     */
    public CompletableFuture<Void> updateActiveDevice(String userId, String deviceId) {
        log.debug("Updating active device for user: {} to device: {}", userId, deviceId);
        
        return CompletableFuture.runAsync(() -> {
            try {
                DatabaseReference userPresenceRef = presenceReference.child(userId);
                
                Map<String, Object> deviceData = Map.of(
                    "current_device", deviceId,
                    "last_updated", System.currentTimeMillis(),
                    "status", "online"
                );
                
                userPresenceRef.child("current_device").setValueAsync(deviceData);
                log.debug("Active device updated in Firebase for user: {}", userId);
                
            } catch (Exception e) {
                log.error("Failed to update active device in Firebase: {}", e.getMessage(), e);
            }
        });
    }
    
    /**
     * Updates user presence status.
     * 
     * @param userId User identifier
     * @param status Presence status (online, offline, away)
     */
    public CompletableFuture<Void> updatePresence(String userId, String status) {
        log.debug("Updating presence for user: {} to status: {}", userId, status);
        
        return CompletableFuture.runAsync(() -> {
            try {
                DatabaseReference userPresenceRef = presenceReference.child(userId);
                
                Map<String, Object> presenceData = Map.of(
                    "status", status,
                    "last_updated", System.currentTimeMillis()
                );
                
                userPresenceRef.child("status").setValueAsync(presenceData);
                log.debug("Presence updated in Firebase for user: {}", userId);
                
            } catch (Exception e) {
                log.error("Failed to update presence in Firebase: {}", e.getMessage(), e);
            }
        });
    }
    
    /**
     * Casts media to a specific device for all users.
     * Used for AI-generated media sharing between devices.
     * 
     * @param userId User identifier
     * @param mediaType Type of media (image, video, audio)
     * @param mediaUrl URL of the media content
     */
    public CompletableFuture<Void> castMedia(String userId, String mediaType, String mediaUrl) {
        log.debug("Casting media for user: {} type: {} url: {}", userId, mediaType, mediaUrl);
        
        return CompletableFuture.runAsync(() -> {
            try {
                DatabaseReference mediaRef = mediaReference.child("active_media");
                
                Map<String, Object> mediaData = Map.of(
                    "userId", userId,
                    "type", mediaType,
                    "url", mediaUrl,
                    "timestamp", System.currentTimeMillis(),
                    "expires_at", System.currentTimeMillis() + (5 * 60 * 1000) // 5 minutes
                );
                
                mediaRef.push().setValueAsync(mediaData);
                log.debug("Media casted to Firebase for user: {}", userId);
                
            } catch (Exception e) {
                log.error("Failed to cast media in Firebase: {}", e.getMessage(), e);
            }
        });
    }
    
    /**
     * Gets the current active device for a user.
     * 
     * @param userId User identifier
     * @return CompletableFuture with device ID
     */
    public CompletableFuture<String> getActiveDevice(String userId) {
        log.debug("Getting active device for user: {}", userId);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                DatabaseReference userPresenceRef = presenceReference.child(userId).child("current_device");
                
                // For now, return a default value since Firebase synchronous get is complex
                return "unknown";
                
            } catch (Exception e) {
                log.error("Failed to get active device from Firebase: {}", e.getMessage(), e);
                return "unknown";
            }
        });
    }
    
    /**
     * Clears active media casting.
     * Called when media expires or is dismissed.
     * 
     * @param mediaId Media identifier to clear
     */
    public CompletableFuture<Void> clearMedia(String mediaId) {
        log.debug("Clearing media: {}", mediaId);
        
        return CompletableFuture.runAsync(() -> {
            try {
                mediaReference.child("active_media").child(mediaId).removeValueAsync();
                log.debug("Media cleared in Firebase: {}", mediaId);
                
            } catch (Exception e) {
                log.error("Failed to clear media in Firebase: {}", e.getMessage(), e);
            }
        });
    }
    
    /**
     * Sets up user structure in Firebase if it doesn't exist.
     * Initializes the basic structure for new users.
     * 
     * @param userId User identifier
     */
    public CompletableFuture<Void> setupUserStructure(String userId) {
        log.debug("Setting up user structure for: {}", userId);
        
        return CompletableFuture.runAsync(() -> {
            try {
                DatabaseReference userRef = chatsReference.child(userId);
                
                // Initialize basic structure
                Map<String, Object> userStructure = Map.of(
                    "created_at", System.currentTimeMillis(),
                    "settings", Map.of(
                        "notifications_enabled", true,
                        "sync_enabled", true
                    )
                );
                
                userRef.updateChildrenAsync(userStructure);
                log.debug("User structure initialized in Firebase: {}", userId);
                
            } catch (Exception e) {
                log.error("Failed to setup user structure in Firebase: {}", e.getMessage(), e);
            }
        });
    }
    
    /**
     * Checks if user has premium subscription.
     * For now, returns false for all users (can be enhanced with payment integration).
     * 
     * @param userId User identifier
     * @return true if user is premium, false otherwise
     */
    public boolean checkUserSubscription(String userId) {
        // 🔒 For now, all users are standard (can be enhanced with payment system)
        // TODO: Integrate with payment provider (Stripe, Razorpay, etc.)
        log.debug("Checking subscription for user: {} - Currently: STANDARD", userId);
        return false; // All users are standard for now
    }
}
