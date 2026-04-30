package com.maeve.controller;

import com.maeve.model.Task;
import com.maeve.model.UserState;
import com.maeve.service.AlarmService;
import com.maeve.service.SchedulerService;
import com.maeve.service.VoiceOrchestrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/life")
public class LifeOSController {

    @Autowired
    private SchedulerService schedulerService;
    
    @Autowired
    private VoiceOrchestrationService voiceOrchestrator;
    
    @Autowired
    private AlarmService alarmService; // <-- Inject this

    // Local Storage for Demo
    private UserState currentUserState = new UserState();
    private List<Task> myTasks = new ArrayList<>();

    // 1. Initial State Set karo
    @PostMapping("/init")
    public String initState(@RequestBody UserState state) {
        this.currentUserState = state;
        return "State Updated! Current Stress: " + state.getStressLevel();
    }

    // 2. Task Add karo (Ye automatic reschedule karega)
    @PostMapping("/add-task")
    public List<Task> addTask(@RequestBody Task task) {
        myTasks.add(task);
        
        // 1. Schedule Generate karo (returns Map now)
        Map<String, Object> scheduleResponse = schedulerService.generateSchedule(myTasks, currentUserState);
        
        // 2. Extract the schedule list from response
        List<Task> newSchedule = new ArrayList<>();
        if (scheduleResponse.get("schedule") != null) {
            List<Map<String, Object>> scheduleList = (List<Map<String, Object>>) scheduleResponse.get("schedule");
            for (Map<String, Object> taskData : scheduleList) {
                Task newTask = new Task();
                newTask.setId((String) taskData.get("id"));
                newTask.setTitle((String) taskData.get("title"));
                newTask.setTimeSlot((String) taskData.get("timeSlot"));
                newTask.setInstruction((String) taskData.get("instruction"));
                newTask.setCategory((String) taskData.get("category"));
                newTask.setStatus((String) taskData.get("status"));
                newTask.setPriorityScore((Integer) taskData.get("priorityScore"));
                newSchedule.add(newTask);
            }
        }
        
        // 2. Alarms Sync karo (IMPORTANT STEP) 🟢
        alarmService.syncAlarms(newSchedule); 
        
        // 3. Voice Feedback
        voiceOrchestrator.queueSpeech("Schedule updated. Alarm set for " + task.getTitle());
        
        return newSchedule;
    }
}
