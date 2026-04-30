package com.maeve.service;

import com.google.firebase.database.DatabaseReference;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class LifeManagerService {

    private final VoiceService voiceService;
    private final DatabaseReference mediaReference; // Using existing ref for demo, ideally creating tasksReference
    
    // Local Cache (Sync with Firebase ideally)
    private Map<String, String> dailySchedule = new HashMap<>();

    public LifeManagerService(VoiceService voiceService, DatabaseReference mediaReference) {
        this.voiceService = voiceService;
        this.mediaReference = mediaReference;
    }

    // 1. Task Add with Persistence
    public void addTask(String time, String category, String task) {
        dailySchedule.put(time, category + ": " + task);
        
        // FIREBASE PUSH (So we don't lose it on restart)
        try {
            String taskId = time.replace(":", "");
            mediaReference.getParent().child("tasks").child(taskId).setValueAsync(Map.of(
                "time", time,
                "category", category,
                "description", task,
                "status", "pending"
            ));
        } catch (Exception e) {
            log.error("Firebase save failed", e);
        }

        log.info("📅 Task Added & Saved: {} - {}", time, task);
    }

    @Scheduled(cron = "0 * * * * *") 
    public void checkRoutine() {
        String now = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));
        
        if (dailySchedule.containsKey(now)) {
            String task = dailySchedule.get(now);
            // Use 'SEXY' or 'STRICT' voice based on category
            String emotion = task.contains("WORK") ? "ANGRY" : "HAPPY"; 
            voiceService.generateAudio("Honey, it's " + now + ". " + task, emotion);
            dailySchedule.remove(now);
        }
    }
}
