package com.maeve.service;

import com.google.firebase.database.ChildEventListener;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class CommandListenerService {

    @Autowired
    private FirebaseDatabase firebaseDatabase;

    private String userId = "user_pro_01"; // Default user, can be dynamic

    @PostConstruct
    public void initializeCommandListener() {
        String commandsPath = "users/" + userId + "/commands";
        DatabaseReference commandsRef = firebaseDatabase.getReference(commandsPath);
        
        commandsRef.addChildEventListener(new ChildEventListener() {
            @Override
    public void onChildAdded(DataSnapshot snapshot, String previousChildName) {
        executeCommand(snapshot);
    }

    @Override
    public void onChildChanged(DataSnapshot snapshot, String previousChildName) {
        executeCommand(snapshot);
    }

    @Override
    public void onChildRemoved(DataSnapshot snapshot) {
        System.out.println("🗑️ Command removed: " + snapshot.getKey());
    }

    @Override
    public void onChildMoved(DataSnapshot snapshot, String previousChildName) {
        // Not needed for commands
    }

    @Override
    public void onCancelled(DatabaseError error) {
        System.err.println("❌ Command listener error: " + error.getMessage());
    }
        });
        
        System.out.println("🎯 Firebase Command Listener Started");
    }

    private void executeCommand(DataSnapshot commandSnapshot) {
        try {
            Object data = commandSnapshot.getValue();
            if (data == null) return;

            String action = "";
            String payload = "";

            // DESI JUGAD: Check if data is a Map (Complex) or String (Simple)
            if (data instanceof java.util.Map) {
                java.util.Map<String, Object> map = (java.util.Map<String, Object>) data;
                action = String.valueOf(map.get("action"));
                payload = String.valueOf(map.get("payload"));
            } else if (data instanceof String) {
                // Agar galti se sirf String bhej di toh use payload maan lo
                action = "SHELL_EXEC";
                payload = (String) data;
            }

            System.out.println("� Received: " + action + " -> " + payload);

            if ("SHELL_EXEC".equals(action)) {
                boolean success = executeWithProcessBuilder(payload);
                updateCommandStatus(commandSnapshot.getKey(), success ? "COMPLETED" : "FAILED");
                
                if (success) {
                    maeveSpeak("Command executed successfully!", "HAPPY");
                } else {
                    maeveSpeak("Command failed, please check logs", "SAD");
                }
            } 
        } catch (Exception e) {
            System.err.println("❌ Parsing Error: " + e.getMessage());
            updateCommandStatus(commandSnapshot.getKey(), "FAILED");
        }
    }

    private boolean executeAction(String action, String payload) {
        try {
            switch (action) {
                case "OPEN_FILE":
                    return openFile(payload);
                case "SHELL_EXEC":
                    return executeShellCommand(payload);
                case "OPEN_URL":
                    return openUrl(payload);
                case "PLAY_AUDIO":
                    return playAudio(payload);
                default:
                    System.out.println("⚠️ Unknown action: " + action);
                    return false;
            }
        } catch (Exception e) {
            System.err.println("❌ Action execution failed: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    private boolean openFile(String filePath) {
        try {
            System.out.println("🛠️ Attempting to open file: " + filePath);
            
            // Use 'start' command with proper Windows handling
            ProcessBuilder pb = new ProcessBuilder("cmd.exe", "/c", "start", "\"\"", filePath);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Capture output for debugging
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println("💻 Windows Output: " + line);
            }
            
            int exitCode = process.waitFor();
            System.out.println("📂 File opened: " + filePath + " (Exit Code: " + exitCode + ")");
            return exitCode == 0;
            
        } catch (Exception e) {
            System.err.println("❌ Failed to open file: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    private boolean executeShellCommand(String command) {
        if (command == null || command.equals("null")) return false;

        try {
            System.out.println("🚀 Triggering: " + command);

            // Try standard ProcessBuilder first
            boolean success = executeWithProcessBuilder(command);
            
            // If that fails, try NirCmd as fallback
            if (!success) {
                System.out.println("🔄 ProcessBuilder failed, trying NirCmd fallback...");
                success = executeWithNirCmd(command);
            }
            
            return success;

        } catch (Exception e) {
            System.err.println("❌ Execution Error: " + e.getMessage());
            return false;
        }
    }

    private boolean executeWithProcessBuilder(String command) {
        try {
            // Standard Windows UI launch command
            String[] commandArray = {"cmd.exe", "/c", "start", "", command};
            ProcessBuilder pb = new ProcessBuilder(commandArray);
            pb.inheritIO(); 
            pb.start();
            
            System.out.println("🚀 Maeve launched: " + command);
            
            // Awaaz trigger karna - POST to /generate
            maeveSpeak("Command executed successfully", "HAPPY");
            
            return true;
        } catch (Exception e) {
            System.err.println("❌ Execution Error: " + e.getMessage());
            return false;
        }
    }

    private boolean executeWithNirCmd(String command) {
        try {
            // NirCmd fail-safe for Session 0 isolation
            String nircmdCommand = "nircmd.exe exec show " + command;
            
            ProcessBuilder pb = new ProcessBuilder("cmd.exe", "/c", nircmdCommand);
            pb.inheritIO();
            
            Process process = pb.start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            
            System.out.println("🔧 NirCmd Triggered: " + command + " | Success: " + finished);
            return finished;

        } catch (Exception e) {
            System.err.println("❌ NirCmd Error: " + e.getMessage());
            System.err.println("💡 Tip: Download NirCmd from https://www.nirsoft.net/utils/nircmd.html");
            return false;
        }
    }

    private boolean openUrl(String url) {
        try {
            System.out.println("🛠️ Attempting to open URL: " + url);
            
            // Use 'start' command for URLs
            ProcessBuilder pb = new ProcessBuilder("cmd.exe", "/c", "start", "\"\"", url);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Capture output for debugging
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println("💻 Windows Output: " + line);
            }
            
            int exitCode = process.waitFor();
            System.out.println("🌐 URL opened: " + url + " (Exit Code: " + exitCode + ")");
            return exitCode == 0;
            
        } catch (Exception e) {
            System.err.println("❌ Failed to open URL: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    private boolean playAudio(String audioPath) {
        try {
            System.out.println("🛠️ Attempting to play audio: " + audioPath);
            
            // Use 'start' command for audio files
            ProcessBuilder pb = new ProcessBuilder("cmd.exe", "/c", "start", "\"\"", audioPath);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Capture output for debugging
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println("💻 Windows Output: " + line);
            }
            
            int exitCode = process.waitFor();
            System.out.println("🔊 Audio played: " + audioPath + " (Exit Code: " + exitCode + ")");
            return exitCode == 0;
            
        } catch (Exception e) {
            System.err.println("❌ Failed to play audio: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    private void maeveSpeak(String text, String style) {
        try {
            // Python server expects POST on /generate
            java.net.URL url = new java.net.URL((System.getenv("VISION_SERVICE_URL") != null ? System.getenv("VISION_SERVICE_URL") : "http://127.0.0.1:5003") + "/generate");
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            
            conn.setRequestMethod("POST"); 
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            // JSON Body matching Python's request.json
            String jsonInputString = String.format("{\"text\": \"%s\", \"style\": \"%s\"}", text, style);

            try (java.io.OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInputString.getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            System.out.println("🎤 Maeve Voice Response Code: " + responseCode);
            
        } catch (Exception e) {
            System.out.println("🔇 Voice failed: " + e.getMessage());
        }
    }

    private void updateCommandStatus(String commandId, String status) {
        try {
            String statusPath = "users/" + userId + "/commands/" + commandId + "/status";
            DatabaseReference statusRef = firebaseDatabase.getReference(statusPath);
            statusRef.setValueAsync(status);
            
            System.out.println("✅ Command status updated: " + commandId + " -> " + status);
        } catch (Exception e) {
            System.err.println("❌ Failed to update command status: " + e.getMessage());
        }
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
