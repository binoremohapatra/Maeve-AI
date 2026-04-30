package com.maeve.dto; // Ya com.maeve.dto

public class CareResponse {
    private String replyText;
    private String mascotAction; // DANCE, WAVE, SLEEP
    private String emotion;      // HAPPY, SAD, BLUSH
    private String audioBase64;  // 🔊 VOICE DATA YAHAN AAYEGA

    public CareResponse(String replyText, String mascotAction, String emotion, String audioBase64) {
        this.replyText = replyText;
        this.mascotAction = mascotAction;
        this.emotion = emotion;
        this.audioBase64 = audioBase64;
    }

    // Getters and Setters
    public String getReplyText() { return replyText; }
    public String getMascotAction() { return mascotAction; }
    public String getEmotion() { return emotion; }
    public String getAudioBase64() { return audioBase64; }
}
