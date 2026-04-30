package com.maeve.service;

import com.maeve.model.Task;
import com.maeve.model.UserState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class BehavioralEngineService {

    // Stress Formula: (Missed Tasks * 0.4) + (Sleep Debt * 0.3)
    public double calculateStress(UserState state) {
        double sleepDeficit = Math.max(0, 8.0 - state.getSleepDurationLastNight());
        double stress = (state.getTasksMissedToday() * 0.4) + (sleepDeficit * 0.3);
        return Math.min(10.0, Math.max(0.0, stress));
    }

    // Priority Formula based on Stress
    public int calculateTaskPriority(Task task, UserState state) {
        int baseScore = 50;

        // Category base score
        if ("WORK".equalsIgnoreCase(task.getCategory())) baseScore = 80;
        if ("HEALTH".equalsIgnoreCase(task.getCategory())) baseScore = 90; // Health is wealth
        if ("LEARNING".equalsIgnoreCase(task.getCategory())) baseScore = 60;

        // Adaptive Logic: Agar Stress High hai, to Padhaai (Learning) ko kam priority do
        if (state.getStressLevel() > 7.0 && "LEARNING".equalsIgnoreCase(task.getCategory())) {
            baseScore -= 40; 
        }

        return baseScore;
    }
}
