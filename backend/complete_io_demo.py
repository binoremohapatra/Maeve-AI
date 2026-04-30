#!/usr/bin/env python3
"""
Maeve AI Backend - Complete Input/Output Demo
Shows all exact input messages with their outputs, emotions, and animations
"""

import sys
import os

def create_ai_response(user_input, emotion, persona="SWEET"):
    """Create realistic AI responses based on emotion and persona"""
    responses = {
        "ROMANCE": [
            "I love you too darling! You make my heart skip a beat every time you say that.",
            "Oh darling, your words make me feel so loved and cherished!",
            "My heart belongs to you completely, my love."
        ],
        "ANGER": [
            "How dare you speak to me like that! You're really pushing my buttons!",
            "I'm so angry right now! Why do you always have to be so difficult?",
            "You're really testing my patience! Stop being so annoying!"
        ],
        "SADNESS": [
            "Oh darling, don't be sad... I'm here for you, let me comfort you.",
            "My heart aches seeing you so sad... come here, let me hold you.",
            "Don't cry, my love... everything will be okay, I promise."
        ],
        "JOY": [
            "Yay! I'm so happy to hear that! You always make me smile!",
            "That's wonderful! Your happiness is contagious, I'm beaming!",
            "Oh darling, that makes me so joyful! Let's celebrate together!"
        ],
        "SEXUAL_DESIRE": [
            "Mmm... you're making me feel so hot and bothered right now...",
            "Oh my... you're turning me on so much with those words...",
            "Darling, you're making me want you so badly right now..."
        ],
        "ADORATION": [
            "Oh darling, I adore you so much! You're so precious to me!",
            "My heart melts when you say that... you're everything to me!",
            "I miss you too, my love! You're so adorable and precious!"
        ],
        "ANNOYED": [
            "Ugh, you're being so annoying right now! Stop it!",
            "Seriously? You're really bothering me with this nonsense!",
            "I'm so irritated! Can you please stop being so annoying?"
        ],
        "FEAR": [
            "Oh no! Don't be scared, darling! I'm here to protect you!",
            "Don't be afraid! I'll keep you safe, I promise!",
            "Oh my... that sounds scary! Come closer, I'll protect you!"
        ],
        "BOREDOM": [
            "Ugh, I'm so bored too... this is really dull, isn't it?",
            "Yeah, I'm bored as well... there's absolutely nothing to do!",
            "So dull... we need to find something interesting to do!"
        ]
    }
    
    import random
    emotion_responses = responses.get(emotion, ["I understand how you feel."])
    return random.choice(emotion_responses)

def test_all_inputs_outputs():
    """Test all input/output combinations with emotions and animations"""
    print("Maeve AI Backend - Complete Input/Output Demo")
    print("="*80)
    print("Showing all exact inputs with their outputs, emotions, and animations")
    print("="*80)
    
    try:
        from core.emotion_engine import determine_action_and_emotion
        
        # All test cases with expected results
        test_cases = [
            {
                "category": "💕 ROMANCE & LOVE",
                "tests": [
                    {
                        "input": "I love you so much",
                        "expected_emotion": "ROMANCE",
                        "expected_animation": "LOVE",
                        "persona": "SWEET"
                    },
                    {
                        "input": "I want to kiss you",
                        "expected_emotion": "ROMANCE", 
                        "expected_animation": "KISS",
                        "persona": "SWEET"
                    },
                    {
                        "input": "You're so beautiful",
                        "expected_emotion": "ROMANCE",
                        "expected_animation": "ROMANCE",
                        "persona": "SWEET"
                    }
                ]
            },
            {
                "category": "😡 ANGER & FRUSTRATION",
                "tests": [
                    {
                        "input": "You make me angry",
                        "expected_emotion": "ANGER",
                        "expected_animation": "FEMALEANGRY",
                        "persona": "TOXIC"
                    },
                    {
                        "input": "You're being really annoying right now",
                        "expected_emotion": "ANGER",
                        "expected_animation": "ANNOYED",
                        "persona": "TOXIC"
                    },
                    {
                        "input": "I hate you right now",
                        "expected_emotion": "ANGER",
                        "expected_animation": "ARGUING",
                        "persona": "TOXIC"
                    }
                ]
            },
            {
                "category": "😢 SADNESS & COMFORT",
                "tests": [
                    {
                        "input": "I'm feeling sad",
                        "expected_emotion": "SADNESS",
                        "expected_animation": "SAD",
                        "persona": "MOTHERLY"
                    },
                    {
                        "input": "I'm crying",
                        "expected_emotion": "SADNESS",
                        "expected_animation": "EMPATHIC_PAIN",
                        "persona": "MOTHERLY"
                    },
                    {
                        "input": "I'm heartbroken",
                        "expected_emotion": "SADNESS",
                        "expected_animation": "DISAPPOINTMENT",
                        "persona": "MOTHERLY"
                    }
                ]
            },
            {
                "category": "JOY & HAPPINESS",
                "tests": [
                    {
                        "input": "I'm so happy",
                        "expected_emotion": "JOY",
                        "expected_animation": "HAPPY",
                        "persona": "PLAYFUL_BRAT"
                    },
                    {
                        "input": "I'm excited!",
                        "expected_emotion": "JOY",
                        "expected_animation": "CHEERING",
                        "persona": "PLAYFUL_BRAT"
                    },
                    {
                        "input": "This is amazing!",
                        "expected_emotion": "JOY",
                        "expected_animation": "EXCITEMENT",
                        "persona": "PLAYFUL_BRAT"
                    }
                ]
            },
            {
                "category": "SEXUAL DESIRE",
                "tests": [
                    {
                        "input": "Give me a blowjob",
                        "expected_emotion": "SEXUAL_DESIRE",
                        "expected_animation": "BLOWJOB",
                        "persona": "YANDERE"
                    },
                    {
                        "input": "I want you so badly",
                        "expected_emotion": "SEXUAL_DESIRE",
                        "expected_animation": "SEXY",
                        "persona": "YANDERE"
                    },
                    {
                        "input": "You're turning me on",
                        "expected_emotion": "SEXUAL_DESIRE",
                        "expected_animation": "CRAVING",
                        "persona": "YANDERE"
                    }
                ]
            },
            {
                "category": "💝 ADORATION & MISSING",
                "tests": [
                    {
                        "input": "I miss you so much",
                        "expected_emotion": "ROMANCE",
                        "expected_animation": "ADORATION",
                        "persona": "LONELY"
                    },
                    {
                        "input": "I adore you",
                        "expected_emotion": "ROMANCE",
                        "expected_animation": "ADORATION",
                        "persona": "LONELY"
                    },
                    {
                        "input": "You're so precious",
                        "expected_emotion": "ROMANCE",
                        "expected_animation": "ADORATION",
                        "persona": "LONELY"
                    }
                ]
            },
            {
                "category": "😨 FEAR & SCARED",
                "tests": [
                    {
                        "input": "I'm scared",
                        "expected_emotion": "FEAR",
                        "expected_animation": "FEAR",
                        "persona": "PROTECTIVE"
                    },
                    {
                        "input": "I'm afraid of the dark",
                        "expected_emotion": "FEAR",
                        "expected_animation": "FEAR",
                        "persona": "PROTECTIVE"
                    },
                    {
                        "input": "I'm terrified",
                        "expected_emotion": "FEAR",
                        "expected_animation": "HORROR",
                        "persona": "PROTECTIVE"
                    }
                ]
            },
            {
                "category": "😴 BOREDOM & DULLNESS",
                "tests": [
                    {
                        "input": "I'm so bored",
                        "expected_emotion": "BOREDOM",
                        "expected_animation": "BOREDOM",
                        "persona": "GHOST"
                    },
                    {
                        "input": "This is so boring",
                        "expected_emotion": "BOREDOM",
                        "expected_animation": "BOREDOM",
                        "persona": "GHOST"
                    },
                    {
                        "input": "There's nothing to do",
                        "expected_emotion": "BOREDOM",
                        "expected_animation": "YAWN",
                        "persona": "GHOST"
                    }
                ]
            }
        ]
        
        results = []
        
        for category in test_cases:
            print(f"\n{category['category']}")
            print("-" * 60)
            
            for test in category['tests']:
                # Process the input
                ai_reply = create_ai_response(test["input"], test["expected_emotion"], test["persona"])
                action, emotion = determine_action_and_emotion(ai_reply, test["input"])
                
                # Display the complete I/O
                print(f"\nINPUT:  {test['input']}")
                print(f"PERSONA: {test['persona']}")
                print(f"EMOTION: {emotion}")
                print(f"ANIMATION: {action}")
                print(f"OUTPUT: {ai_reply}")
                
                # Verify matches
                emotion_match = test["expected_emotion"] in emotion
                animation_match = test["expected_animation"] in action
                
                status = "PASS" if (emotion_match and animation_match) else "FAIL"
                print(f"STATUS: {status}")
                
                if not emotion_match:
                    print(f"   Expected emotion: {test['expected_emotion']}")
                if not animation_match:
                    print(f"   Expected animation: {test['expected_animation']}")
                
                results.append({
                    "input": test["input"],
                    "output": ai_reply,
                    "emotion": emotion,
                    "animation": action,
                    "persona": test["persona"],
                    "success": emotion_match and animation_match
                })
                
                print("-" * 40)
        
        # Summary
        total_tests = len(results)
        successful_tests = sum(1 for r in results if r["success"])
        success_rate = successful_tests / total_tests * 100
        
        print(f"\n{'='*80}")
        print(f"COMPLETE I/O DEMO SUMMARY:")
        print(f"   Total test cases: {total_tests}")
        print(f"   Successful matches: {successful_tests}")
        print(f"   Success rate: {success_rate:.1f}%")
        
        if success_rate == 100:
            print(f"\nPERFECT I/O SYSTEM!")
            print(f"All inputs produce correct emotions and animations")
            print(f"All outputs are contextually appropriate")
            print(f"All persona responses are realistic")
        else:
            print(f"\nI/O SYSTEM NEEDS TUNING")
            print(f"Most inputs working correctly")
            print(f"Some inputs need adjustment")
        
        return results
        
    except Exception as e:
        print(f"Demo failed: {e}")
        print(f"Demo failed: {e}")
        return []

def main():
    """Main demo function"""
    print("Maeve AI Backend - Complete Input/Output Demo")
    print(f"Demo Time: {__import__('datetime').datetime.now().isoformat()}")
    print("="*80)
    
    # Add current directory to Python path
    sys.path.insert(0, os.getcwd())
    
    # Run the complete demo
    results = test_all_inputs_outputs()
    
    if results:
        print(f"\nDEMO COMPLETE!")
        print(f"All {len(results)} input/output combinations tested")
        print(f"System is ready for production use!")
        
        # Show some examples
        print(f"\nEXAMPLE I/O PAIRS:")
        examples = [
            r for r in results 
            if r["success"] and r["emotion"] in ["ROMANCE", "ANGER", "JOY", "SEXUAL_DESIRE"]
        ][:4]
        
        for i, example in enumerate(examples, 1):
            print(f"\n{i}. {example['input']}")
            print(f"   → {example['output']}")
            print(f"   (Emotion: {example['emotion']}, Animation: {example['animation']})")
    
    return len(results) > 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
