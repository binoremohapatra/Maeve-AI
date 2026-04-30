package com.maeve.model;

import lombok.Data;

@Data
public class Task implements Comparable<Task> {
    private String id; // UUID for React keys
    private String title;
    private String category; // WORK, HEALTH, LEARNING
    private String timeSlot; // "HH:mm"
    private String instruction; // AI-generated step-by-step instruction
    private int priorityScore; // Calculated automatically
    private String status; // pending, completed, etc.
    
    // For sorting: High priority first
    @Override
    public int compareTo(Task other) {
        return Integer.compare(other.priorityScore, this.priorityScore);
    }
}
