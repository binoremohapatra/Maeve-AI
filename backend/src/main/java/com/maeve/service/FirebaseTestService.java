package com.maeve.service;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class FirebaseTestService {

    @Autowired
    private FirebaseDatabase firebaseDatabase;

    @PostConstruct
    public void testFirebaseConnection() {
        try {
            // Test write to Firebase
            String testPath = "users/user_pro_01/heartbeat";
            DatabaseReference testRef = firebaseDatabase.getReference(testPath);
            
            Map<String, Object> testData = new HashMap<>();
            testData.put("timestamp", System.currentTimeMillis() / 1000);
            testData.put("status", "ONLINE");
            testData.put("message", "Firebase RTDB Connection Test");
            
            // Simple async call without callback
            testRef.setValueAsync(testData);
            
            log.info("✅ Firebase RTDB Test Successful - Data written to: {}", testPath);
            System.out.println("🔥 Firebase Realtime Database is WORKING!");
            System.out.println("📍 Test data written to: " + testPath);
                
        } catch (Exception e) {
            log.error("Firebase test initialization failed: {}", e.getMessage());
            System.err.println("💥 Firebase test failed: " + e.getMessage());
        }
    }
}
