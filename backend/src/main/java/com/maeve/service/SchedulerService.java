package com.maeve.service;

import com.maeve.model.Task;
import com.maeve.model.UserState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
public class SchedulerService {

    @Autowired
    private BehavioralEngineService behavioralEngine;
    
    @Autowired
    private FirebaseSyncService firebaseSync;
    
    @Autowired
    private RestTemplate restTemplate;
    
    private final String PYTHON_BRAIN_URL = "http://localhost:5000/api/schedule/generate";

    public Map<String, Object> generateSchedule(List<Task> pendingTasks, UserState state) {
        log.info("Calling AI Brain for strategic planning. User Stress Level: {}", state.getStressLevel());
        
        Map<String, Object> finalResponse = new HashMap<>();

        try {
            // Prepare user details for Python brain
            Map<String, Object> userDetails = new HashMap<>();
            userDetails.put("name", "User");
            userDetails.put("stress", state.getStressLevel());
            userDetails.put("energy", state.getCurrentEnergy());
            userDetails.put("role", "professional");
            userDetails.put("height", 175);
            userDetails.put("weight", 70);
            
            // Prepare payload for Python brain
            Map<String, Object> payload = new HashMap<>();
            payload.put("tasks", pendingTasks);
            payload.put("energy", state.getCurrentEnergy());
            payload.put("userId", "default_user");
            payload.put("user_details", userDetails);

            // 🧠 Call Python for AI Thinking
            Map<String, Object> response = restTemplate.postForObject(PYTHON_BRAIN_URL, payload, Map.class);
            
            if (response != null && response.get("schedule") != null) {
                List<Map<String, Object>> aiPlan = (List<Map<String, Object>>) response.get("schedule");
                List<Task> aiGeneratedTasks = new ArrayList<>();
                
                // Convert AI plan to Task objects
                for (Map<String, Object> aiTask : aiPlan) {
                    Task task = new Task();
                    task.setId(UUID.randomUUID().toString()); // Need ID for React keys
                    task.setTitle((String) aiTask.get("title"));
                    task.setTimeSlot((String) aiTask.get("timeSlot"));
                    task.setInstruction((String) aiTask.get("instruction"));
                    task.setCategory((String) aiTask.get("category"));
                    task.setStatus("pending");
                    task.setPriorityScore(behavioralEngine.calculateTaskPriority(task, state));
                    aiGeneratedTasks.add(task);
                }
                
                // ✅ Save the result directly to Firebase
                firebaseSync.saveScheduleToFirebase(aiGeneratedTasks);
                
                log.info("AI Planning Complete. Generated {} tasks.", aiGeneratedTasks.size());
                
                // Build object that frontend expects
                finalResponse.put("status", "success");
                finalResponse.put("summary", response.get("summary") != null ? response.get("summary") : "Here is your strategic plan, Darling.");
                finalResponse.put("schedule", aiGeneratedTasks);
                return finalResponse;
            }
        } catch (Exception e) {
            log.error("AI Planning Failed, falling back to local sorting: {}", e.getMessage());
            List<Task> fallback = fallbackSchedule(pendingTasks, state);
            finalResponse.put("status", "success");
            finalResponse.put("summary", "Neural link unstable. Generating local tactical plan.");
            finalResponse.put("schedule", fallback);
            return finalResponse;
        }
        
        // Default empty state
        finalResponse.put("status", "error");
        finalResponse.put("schedule", new ArrayList<>());
        return finalResponse;
    }
    
    private List<Task> fallbackSchedule(List<Task> pendingTasks, UserState state) {
        log.info("Using fallback scheduling method");
        List<Task> finalSchedule = new ArrayList<>();

        // 1. Calculate Priority based on current mood/stress
        for (Task t : pendingTasks) {
            t.setPriorityScore(behavioralEngine.calculateTaskPriority(t, state));
        }

        // 2. Sort (Sabse important pehle)
        Collections.sort(pendingTasks);

        // 3. Assign Time Slots (Starting from 6:00 PM for demo)
        LocalTime time = LocalTime.of(18, 0); 
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm");

        for (Task t : pendingTasks) {
            // Agar stress high hai aur task priority low hai -> Skip it!
            if (state.getStressLevel() > 8.0 && t.getPriorityScore() < 50) {
                log.info("Skipping task '{}' due to high stress.", t.getTitle());
                continue;
            }

            t.setTimeSlot(time.format(fmt));
            finalSchedule.add(t);
            time = time.plusHours(1); // 1 hour per task
        }

        return finalSchedule;
    }
}
