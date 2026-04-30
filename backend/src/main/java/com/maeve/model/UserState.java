package com.maeve.model;

import lombok.Data;

@Data
public class UserState {
    private int currentEnergy; // 0-100
    private double stressLevel; // 0.0 - 10.0 (High stress > 7.0)
    private int tasksMissedToday;
    private double sleepDurationLastNight;
}
