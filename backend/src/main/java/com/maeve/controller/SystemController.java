package com.maeve.controller;

import com.sun.management.OperatingSystemMXBean;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.lang.management.ManagementFactory;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/device") // Matches frontend maeveAPI.getDeviceStatus
public class SystemController {

    @GetMapping("/status/{userId}")
    public ResponseEntity<Map<String, Object>> getSystemStatus(@PathVariable String userId) {
        OperatingSystemMXBean osBean = ManagementFactory.getPlatformMXBean(OperatingSystemMXBean.class);

        // Get Real System Stats
        double cpuLoad = osBean.getCpuLoad() * 100;
        long totalRam = osBean.getTotalMemorySize();
        long freeRam = osBean.getFreeMemorySize();
        long usedRam = totalRam - freeRam;
        double ramUsage = ((double) usedRam / totalRam) * 100;

        Map<String, Object> stats = new HashMap<>();
        stats.put("cpu", (int) cpuLoad);
        stats.put("ram", (int) ramUsage);
        stats.put("temperature", 45); // Java can't easily get temp without libraries like OSHI
        stats.put("storage", 0); 

        return ResponseEntity.ok(stats);
    }
}
