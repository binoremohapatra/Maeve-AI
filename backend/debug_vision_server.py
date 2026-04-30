#!/usr/bin/env python3
"""
Debug Vision Server
Show exactly what vision server does with your photos
"""

import requests
import time

def debug_vision_server():
    """Debug vision server behavior"""
    print("DEBUG VISION SERVER")
    print("=" * 50)
    print("This will show exactly what vision server does")
    
    vision_url = "http://localhost:5003"
    
    print("\nTESTING VISION SERVER WITH YOUR PHOTO...")
    
    # Create a test image with a simple face
    import base64
    import numpy as np
    import cv2
    
    # Create test image with white background and simple face
    test_image = np.full((480, 640, 3), 255, dtype=np.uint8)
    
    # Add a simple face (white circle in center)
    center_x, center_y = 320, 240
    cv2.circle(test_image, (center_x, center_y), 50, (255, 255, 255), -1)
    
    # Add text
    cv2.putText(test_image, "TEST FACE", 
               (center_x - 40, center_y - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    
    # Convert to base64
    _, buffer = cv2.imencode('.jpg', test_image)
    image_b64 = base64.b64encode(buffer).decode('utf-8')
    
    try:
        # Activate vision server
        response = requests.post(f"{vision_url}/activate", timeout=5)
        print(f"   Vision activation: {response.status_code}")
        
        # Send image for analysis
        payload = {
            "userId": "debug_test",
            "image": image_b64
        }
        
        response = requests.post(f"{vision_url}/capture", json=payload, timeout=20)
        
        print(f"   Capture response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nVISION SERVER ANALYSIS:")
            print("=" * 50)
            
            print(f"   Status: {data.get('status')}")
            print(f"   Message: {data.get('message')}")
            
            if "analysis" in data:
                analysis = data["analysis"]
                print(f"\nANALYSIS DATA:")
                if isinstance(analysis, dict):
                    for key, value in analysis.items():
                        print(f"   {key}: {value}")
                
                # Check specific fields
                print(f"\nFACE DETECTION CHECK:")
                if "user_appearance" in analysis:
                    user_appearance = analysis["user_appearance"]
                    if isinstance(user_appearance, dict):
                        if "person_detected" in user_appearance:
                            print(f"   Person detected: {user_appearance['person_detected']}")
                        if "emotions" in user_appearance:
                            emotions = user_appearance["emotions"]
                            print(f"   Emotions: {emotions}")
                        if "facial_features" in user_appearance:
                            print(f"   Facial features: {user_appearance['facial_features']}")
                
                print(f"\nBEHAVIORAL ANALYSIS:")
                if "behavioral_analysis" in analysis:
                    behavior = analysis["behavioral_analysis"]
                    print(f"   Behavior: {behavior}")
                
                print(f"\nSCREEN CONTEXT:")
                if "screen_context" in analysis:
                    screen = analysis["screen_context"]
                    print(f"   Screen: {screen}")
                
                print(f"\nVISION DESCRIPTION:")
                if "vision_description" in analysis:
                    description = analysis["vision_description"]
                    print(f"   Description: {description}")
                
                print(f"\nFACIAL MAP:")
                if "facial_map" in analysis:
                    facial_map = analysis["facial_map"]
                    print(f"   Facial map: {facial_map}")
                
                print(f"\nANALYSIS COMPLETE!")
                
                # Check if face was detected
                face_detected = False
                if "user_appearance" in analysis:
                    user_appearance = analysis["user_appearance"]
                    if isinstance(user_appearance, dict):
                        face_detected = user_appearance.get("person_detected", False)
                
                print(f"\nFACE DETECTION RESULT: {face_detected}")
                
                if face_detected:
                    print(f"\nSUCCESS: Vision server detected YOUR face and should analyze with Gemini!")
                else:
                    print(f"\nISSUE: Vision server did NOT detect YOUR face!")
                    print(f"   This explains why you're getting 'vision_blocked'")
                    print(f"   The system needs to see your face to analyze emotions")
            
        else:
            print(f"   Request failed: {response.status_code}")
            
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    debug_vision_server()
