package com.maeve.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling // ⏰ Alarms aur Routine ke liye zaroori hai
@EnableAsync      // ⚡ Firebase save ko background mein bhejega
public class AsyncConfig {
}
