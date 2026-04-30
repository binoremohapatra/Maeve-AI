package com.maeve.service;

import com.maeve.model.Task;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AlarmService {

    @Autowired
    private VoiceOrchestrationService voiceService;

    // Active Alarms list
    private List<Task> activeAlarms = new ArrayList<>();

    // ---------------------------------------------------------
    // 🟢 1. NEW LOGIC (Synced from Life OS)
    // ---------------------------------------------------------
    public void syncAlarms(List<Task> schedule) {
        this.activeAlarms = new ArrayList<>(schedule);
        log.info("⏰ Alarms Synced! Total Tasks: {}", activeAlarms.size());
    }

    // ---------------------------------------------------------
    // � 2. FIX FOR COMPILATION ERROR (Legacy Compatibility)
    // ---------------------------------------------------------
    
    // Fixes: alarmService.setAlarm(value.trim());
    public void setAlarm(String time) {
        Task manualTask = new Task();
        manualTask.setTitle("Quick Alarm");
        manualTask.setCategory("REMINDER");
        manualTask.setTimeSlot(time); // e.g., "07:00"
        manualTask.setPriorityScore(100); // High Priority
        
        this.activeAlarms.add(manualTask);
        log.info("🔔 Manual Alarm Added for: {}", time);
        
        voiceService.queueSpeech("Alarm set for " + time);
    }

    // Fixes: alarmService.setSchedule(value.trim());
    public void setSchedule(String scheduleText) {
        // Since we now use the "Behavioral Engine" for schedules, 
        // we will just log this for now to prevent errors.
        log.info("📝 Legacy Schedule Command Received: {}", scheduleText);
        voiceService.queueSpeech("I received your schedule notes.");
    }

    // ---------------------------------------------------------
    // 🔄 3. THE TRIGGER LOOP (Runs every minute)
    // ---------------------------------------------------------
    @Scheduled(cron = "0 * * * * *")
    public void checkAlarms() {
        if (activeAlarms.isEmpty()) return;

        String currentTime = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));

        // Find tasks scheduled for NOW
        List<Task> tasksToTrigger = activeAlarms.stream()
                .filter(t -> t.getTimeSlot().equals(currentTime))
                .collect(Collectors.toList());

        for (Task task : tasksToTrigger) {
            triggerAlarm(task);
        }
        
        // Remove triggered tasks to avoid repeating
        activeAlarms.removeAll(tasksToTrigger);
    }

    private void triggerAlarm(Task task) {
        log.info("🔔 TRIGGERING ALARM FOR: {}", task.getTitle());

        String message;
        String mood = "NEUTRAL";

        if (task.getCategory() == null) task.setCategory("GENERAL");

        switch (task.getCategory().toUpperCase()) {
            case "WORK":
                message = "It is " + task.getTimeSlot() + ". Focus mode on. " + task.getTitle();
                mood = "FOCUSED";
                break;
            case "HEALTH":
                message = "Health Alert. " + task.getTitle() + ". Please do it now.";
                mood = "HAPPY";
                break;
            case "LEARNING":
                message = "Time to study. Topic is " + task.getTitle();
                mood = "NEUTRAL";
                break;
            case "REMINDER":
                message = "Alarm for " + task.getTimeSlot() + ". " + task.getTitle();
                mood = "HAPPY";
                break;
            default:
                message = "Reminder: " + task.getTitle();
        }

        voiceService.queueSpeech(message);
    }
}
