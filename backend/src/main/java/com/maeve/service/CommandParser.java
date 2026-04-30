package com.maeve.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class CommandParser {

    private static final Pattern TAG_PATTERN = Pattern.compile("<<([A-Z_]+)(?::(.*?)?)?>>");
    private final AlarmService alarmService; // Inject AlarmService

    // Constructor Injection
    public CommandParser(AlarmService alarmService) {
        this.alarmService = alarmService;
    }

    public static class ParsedResult {
        public String cleanText;
        public String action;
        public String expression;

        public ParsedResult(String cleanText, String action, String expression) {
            this.cleanText = cleanText;
            this.action = action;
            this.expression = expression;
        }
    }

    public ParsedResult parse(String rawText) {
        String action = "IDLE";      
        String expression = "NEUTRAL"; 
        
        Matcher matcher = TAG_PATTERN.matcher(rawText);
        while (matcher.find()) {
            String tag = matcher.group(1);     // E.g. ALARM or KISS
            String value = matcher.group(2);   // E.g. 07:00 (Agar value hai)

            if ("ALARM".equals(tag) && value != null) {
                alarmService.setAlarm(value.trim()); // Alarm Set
                log.info("🔔 Alarm Command Detected: " + value);
            } 
            else if ("SCHEDULE".equals(tag) && value != null) {
                alarmService.setSchedule(value.trim()); // Schedule Save
                log.info("📝 Schedule Command Detected");
            }
            else if (isBodyAction(tag)) {
                action = tag;
            } else if (isFaceExpression(tag)) {
                expression = tag;
            }
        }
        
        // Cleanup text
        String noTags = rawText.replaceAll("<<.*?>>", "");
        String cleanText = noTags.replaceAll("\\*.*?\\*", "").trim();

        return new ParsedResult(cleanText, action, expression);
    }

    private boolean isBodyAction(String tag) {
        return tag.equals("WAVE") || tag.equals("DANCE") || tag.equals("BOW") || 
               tag.equals("CLAP") || tag.equals("JUMP") || tag.equals("SIT") ||
               tag.equals("HUG") || tag.equals("KISS") || tag.equals("THINK") ||
               tag.equals("ARGUING");
    }

    private boolean isFaceExpression(String tag) {
        return tag.equals("HAPPY") || tag.equals("SAD") || tag.equals("ANGRY") || 
               tag.equals("SURPRISED") || tag.equals("BLUSH") || tag.equals("WINK") ||
               tag.equals("POUT") || tag.equals("LOVE") || tag.equals("SLEEPY");
    }
}
