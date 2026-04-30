package com.maeve.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
@Slf4j
public class VoiceOrchestrationService {

    @Autowired
    private VoiceService voiceService;

    private final ConcurrentLinkedQueue<String> audioQueue = new ConcurrentLinkedQueue<>();
    private boolean isSpeaking = false;

    public void queueSpeech(String text) {
        audioQueue.offer(text);
        log.info("➕ Added to Voice Queue: " + text);
    }

    // Har 3 second mein check karega ki bolna hai ya nahi
    @Scheduled(fixedRate = 3000)
    public void processQueue() {
        if (!audioQueue.isEmpty()) {
            String text = audioQueue.poll();
            log.info("🎤 Speaking: " + text);
            // Call Python Voice Server
            voiceService.generateAudio(text, "HAPPY"); 
        }
    }
}
