package com.maeve.controller;

import com.maeve.model.DeviceStatusResponse;
import com.maeve.model.CommandRequest;
import com.maeve.service.FirebaseSyncService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile")
@Slf4j
public class MobileController {

    @Autowired
    private FirebaseSyncService firebaseSyncService;

    @GetMapping("/status/{userId}")
    public ResponseEntity<DeviceStatusResponse> getDeviceStatus(@PathVariable String userId) {
        try {
            // In a real implementation, this would query Firebase
            // For now, we'll return a mock response structure
            DeviceStatusResponse response = new DeviceStatusResponse();
            
            // Set user ID in FirebaseSyncService
            firebaseSyncService.setUserId(userId);
            
            // Mock response - in real implementation, query Firebase
            Map<String, Object> pcStatus = new HashMap<>();
            pcStatus.put("online", true);
            pcStatus.put("last_ping", System.currentTimeMillis() / 1000);
            pcStatus.put("local_ip", "192.168.1.33");
            pcStatus.put("device_name", "PC_MAEVE");
            
            response.setPcLocal(pcStatus);
            response.setRecommendation("LOCAL_PC"); // or "CLOUD_GROQ"
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error getting device status: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/command/{userId}")
    public ResponseEntity<Map<String, String>> sendCommand(@PathVariable String userId, 
                                                          @RequestBody CommandRequest command) {
        try {
            // Set user ID in FirebaseSyncService
            firebaseSyncService.setUserId(userId);
            
            // Send command to Firebase
            firebaseSyncService.sendCommand(command.getAction(), command.getPayload());
            
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Command sent successfully");
            response.put("command_id", "cmd_" + System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error sending command: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/sync/{userId}")
    public ResponseEntity<Map<String, String>> syncSession(@PathVariable String userId,
                                                          @RequestBody Map<String, String> request) {
        try {
            String provider = request.get("provider");
            String device = request.get("device");
            
            // Set user ID in FirebaseSyncService
            firebaseSyncService.setUserId(userId);
            
            // Update active session
            firebaseSyncService.setActiveSession(provider, device);
            
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Session synced successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error syncing session: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
