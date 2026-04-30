package com.maeve.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;

@Configuration
@Slf4j
public class FirebaseConfig {
    
    @Value("${firebase.config-path}")
    private String firebaseConfigPath;
    
    @Value("${firebase.database-url}")
    private String databaseUrl;
    
    private FirebaseApp firebaseApp;
    
    @PostConstruct
    public void initializeFirebase() {
        try {
            log.info("Initializing Firebase (Database Only)...");
            
            FileInputStream serviceAccount = new FileInputStream(firebaseConfigPath);
            
            // SIRF DATABASE URL, NO STORAGE BUCKET
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .setDatabaseUrl(databaseUrl)
                    .build();
            
            if (FirebaseApp.getApps().isEmpty()) {
                firebaseApp = FirebaseApp.initializeApp(options, "MaeveHybridEcosystem");
            } else {
                firebaseApp = FirebaseApp.getInstance("MaeveHybridEcosystem");
            }
            
            log.info("✅ Firebase Database Connected Successfully!");
            
        } catch (IOException e) {
            log.error("Failed to initialize Firebase: {}", e.getMessage());
            throw new RuntimeException("Firebase init failed", e);
        }
    }
    
    @Bean
    public FirebaseDatabase firebaseDatabase() {
        return FirebaseDatabase.getInstance(firebaseApp);
    }
    
    @Bean
    public DatabaseReference chatsReference() {
        return FirebaseDatabase.getInstance(firebaseApp).getReference("users");
    }
}
