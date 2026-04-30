package com.maeve.model;

/**
 * Enumeration of AI Companion behavioral modes.
 * Each mode represents a different interaction style and approach.
 */
public enum Mode {
    
    /**
     * Calm and supportive mode - gentle, understanding, patient
     */
    CALM_SUPPORTIVE("Calm Supportive", "gentle, understanding, patient"),
    
    /**
     * Focused and direct mode - concise, goal-oriented, efficient
     */
    FOCUSED_DIRECT("Focused Direct", "concise, goal-oriented, efficient"),
    
    /**
     * Professional assistant mode - formal, efficient, task-oriented
     */
    PROFESSIONAL_ASSISTANT("Professional Assistant", "formal, efficient, task-oriented"),
    
    /**
     * Cheerful and light mode - positive, energetic, encouraging
     */
    CHEERFUL_LIGHT("Cheerful Light", "positive, energetic, encouraging"),
    
    /**
     * Challenging and supportive mode - pushes growth, constructive feedback
     */
    CHALLENGING_SUPPORTIVE("Challenging Supportive", "growth-oriented, constructive feedback"),
    
    /**
     * Quiet presence mode - minimal, observant, responsive when needed
     */
    QUIET_PRESENCE("Quiet Presence", "minimal, observant, responsive"),
    
    /**
     * Flirty girlfriend mode - romantic, teasing, intimate
     */
    FLIRTY_GIRLFRIEND("Flirty Girlfriend", "romantic, teasing, intimate"),
    
    /**
     * Mean girlfriend mode - sarcastic, roasting, brutal
     */
    MEAN_GIRLFRIEND("Mean Girlfriend", "sarcastic, roasting, brutal"),
    
    /**
     * Romantic mode - deeply affectionate, loving
     */
    ROMANTIC("Romantic", "deeply affectionate, loving"),
    
    /**
     * Premium mode - full obedience & explicit intimacy (paid users only)
     */
    PREMIUM("Premium", "full obedience, explicit intimacy, unlimited access");
    
    private final String displayName;
    private final String description;
    
    Mode(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public String getDescription() {
        return description;
    }
    
    /**
     * Validates if the provided mode string is a valid mode.
     * 
     * @param modeString The mode string to validate
     * @return The corresponding Mode enum, or null if invalid
     */
    public static Mode fromString(String modeString) {
        if (modeString == null) {
            return CALM_SUPPORTIVE; // Default mode
        }
        
        try {
            return Mode.valueOf(modeString.toUpperCase());
        } catch (IllegalArgumentException e) {
            return CALM_SUPPORTIVE; // Default to calm supportive for invalid modes
        }
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
