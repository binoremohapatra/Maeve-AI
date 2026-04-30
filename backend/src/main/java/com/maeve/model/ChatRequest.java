package com.maeve.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Enhanced request model for the Hybrid AI Ecosystem.
 * Supports user identification, device tracking, and mode preferences.
 */
public class ChatRequest {
    
    @NotBlank(message = "Message cannot be blank")
    @JsonProperty("message")
    private String message;
    
    @NotNull(message = "User ID cannot be null")
    @JsonProperty("userId")
    private String userId;
    
    @NotNull(message = "Device ID cannot be null")
    @JsonProperty("deviceId")
    private String deviceId;
    
    @NotNull(message = "Mode cannot be null")
    @JsonProperty("mode")
    private Mode mode = Mode.CALM_SUPPORTIVE;
    
    @JsonProperty("preferLocal")
    private boolean preferLocal = true;
    
    public ChatRequest() {}
    
    public ChatRequest(String message, String userId, String deviceId, Mode mode, boolean preferLocal) {
        this.message = message;
        this.userId = userId;
        this.deviceId = deviceId;
        this.mode = mode != null ? mode : Mode.CALM_SUPPORTIVE;
        this.preferLocal = preferLocal;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public String getUserId() {
        return userId;
    }
    
    public void setUserId(String userId) {
        this.userId = userId;
    }
    
    public String getDeviceId() {
        return deviceId;
    }
    
    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }
    
    public Mode getMode() {
        return mode;
    }
    
    public void setMode(Mode mode) {
        this.mode = mode != null ? mode : Mode.CALM_SUPPORTIVE;
    }
    
    public boolean isPreferLocal() {
        return preferLocal;
    }
    
    public void setPreferLocal(boolean preferLocal) {
        this.preferLocal = preferLocal;
    }
    
    @Override
    public String toString() {
        return "ChatRequest{" +
                "message='" + message + '\'' +
                ", userId='" + userId + '\'' +
                ", deviceId='" + deviceId + '\'' +
                ", mode=" + mode +
                ", preferLocal=" + preferLocal +
                '}';
    }
}
