package com.maeve.model;

import lombok.Data;

@Data
public class CommandRequest {
    private String target; // "pc_local" or "mobile"
    private String action; // "OPEN_FILE", "SHELL_EXEC", "OPEN_URL", "PLAY_AUDIO"
    private String payload; // File path, command, URL, or audio path
}
