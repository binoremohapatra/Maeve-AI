package com.maeve.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ChatResponse {
    private String reply;          // Text Response
    private String providerUsed;   // Ollama/Groq
    private String mode;           // Calm/Flirty
    private long responseTime;     // Speed

    @JsonProperty("audioBase64")
    private String audioBase64;    // Voice Data

    @JsonProperty("action")
    private String action;         // Body Movement (e.g., DANCE, WAVE)

    @JsonProperty("expression")
    private String expression;     // Face Emotion (e.g., HAPPY, ANGRY)
    
    // Additional getters/setters for compatibility
    public void setReply(String reply) {
        this.reply = reply;
    }
    
    public void setAction(String action) {
        this.action = action;
    }
    
    public void setExpression(String expression) {
        this.expression = expression;
    }
    
    public void setAudioBase64(String audioBase64) {
        this.audioBase64 = audioBase64;
    }
    
    public void setMode(String mode) {
        this.mode = mode;
    }
    
    public void setResponseTime(long responseTime) {
        this.responseTime = responseTime;
    }
}
