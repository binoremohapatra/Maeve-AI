package com.maeve.service;

import com.google.api.core.ApiFuture;
import com.google.api.core.ApiFutureCallback;
import com.google.api.core.ApiFutures;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class HeartbeatService {

    @Autowired
    private FirebaseDatabase firebaseDatabase;

    private String userId = "user_pro_01"; // Default user, can be dynamic

    @Scheduled(fixedRate = 15000) // Every 15 seconds
    public void sendHeartbeat() {
        try {
            String path = "users/" + userId + "/status/pc_local";
            Map<String, Object> status = new HashMap<>();
            status.put("online", true);
            status.put("last_ping", System.currentTimeMillis() / 1000);
            status.put("local_ip", getLocalIpAddress());
            status.put("device_name", "PC_MAEVE");
            
            DatabaseReference statusRef = firebaseDatabase.getReference(path);
            
            // Simple async call without callback
            statusRef.setValueAsync(status);
            
            log.info("💓 Heartbeat sent to Firebase: {}", status);
            System.out.println("💓 Heartbeat sent: " + status);
            
        } catch (Exception e) {
            log.error("Heartbeat error: {}", e.getMessage());
            System.err.println("❌ Heartbeat error: " + e.getMessage());
        }
    }

    private String getLocalIpAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp() || iface.isVirtual()) {
                    continue;
                }
                
                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (!addr.isLoopbackAddress() && addr.getHostAddress().indexOf(':') == -1) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error getting IP: {}", e.getMessage());
        }
        return "127.0.0.1"; // Fallback
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
