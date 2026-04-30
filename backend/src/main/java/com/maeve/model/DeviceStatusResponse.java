package com.maeve.model;

import lombok.Data;
import java.util.Map;

@Data
public class DeviceStatusResponse {
    private Map<String, Object> pcLocal;
    private Map<String, Object> mobile;
    private Map<String, Object> activeSession;
    private String recommendation; // "LOCAL_PC" or "CLOUD_GROQ"
}
