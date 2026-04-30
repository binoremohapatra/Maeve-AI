package com.maeve.config;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleAllExceptions(Exception ex) {
        // 👇 YE LINE TERE TERMINAL MEIN ASLI ERROR DIKHAYEGI
        System.err.println("🔥🔥🔥 CRITICAL SERVER ERROR 🔥🔥🔥");
        System.err.println("Error Type: " + ex.getClass().getName());
        System.err.println("Message: " + ex.getMessage());
        ex.printStackTrace(); 
        
        return ResponseEntity.status(500).body("Server Error: " + ex.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<String> handleMaxSizeException(MaxUploadSizeExceededException exc) {
        System.err.println("❌ FILE TOO LARGE!");
        return ResponseEntity.status(400).body("File too large!");
    }
}
