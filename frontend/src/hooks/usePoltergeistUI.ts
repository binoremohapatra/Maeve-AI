import { useEffect } from 'react';
import { useMoodStore } from '../stores/moodStore';

const ZALGO_CHARS = ['\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311', '\u0306', '\u0310', '\u0352', '\u0357', '\u0351', '\u0307', '\u0308', '\u030a', '\u0342', '\u0343', '\u0344', '\u034a', '\u034b', '\u034c', '\u0303', '\u0302', '\u030c', '\u0350', '\u0300', '\u0301', '\u030b', '\u030f', '\u0312', '\u0313', '\u0314', '\u033d', '\u0309', '\u0363', '\u0364', '\u0365', '\u0366', '\u0367', '\u0368', '\u0369', '\u036a', '\u036b', '\u036c', '\u036d', '\u036e', '\u036f', '\u0315', '\u031b', '\u031a', '\u0330', '\u033e', '\u035b', '\u0329', '\u032a', '\u032b', '\u032c', '\u032d', '\u032e', '\u032f', '\u0331', '\u0332', '\u0333', '\u0347', '\u0348', '\u0349', '\u034d', '\u034e', '\u0353', '\u0354', '\u0355', '\u0356', '\u0359', '\u035a', '\u0323', '\u0324', '\u0325', '\u0326', '\u0327', '\u0328', '\u0320', '\u0321', '\u0322', '\u0334', '\u0335', '\u0336', '\u0337', '\u0338', '\u0339', '\u033a', '\u033b', '\u033c', '\u0345', '\u034e'];

const corrupt = (text: string, amount: number = 0.5) => {
  let result = '';
  for (const char of text) {
    result += char;
    if (Math.random() < amount) {
       for (let i = 0; i < 3; i++) {
         result += ZALGO_CHARS[Math.floor(Math.random() * ZALGO_CHARS.length)];
       }
    }
  }
  return result;
};

const SCRAMBLE_PERSONAS = new Set(['YANDERE', 'YANDERE_STALKER', 'SADODERE', 'DORODERE', 'EVIL', 'FEAR']);
const DODGE_PERSONAS = new Set(['YANDERE_STALKER', 'DORODERE', 'TOXIC', 'EVIL']);

export const usePoltergeistUI = (options: { chatSelector?: string } = {}) => {
  const { chatSelector = '[data-chat-message]' } = options;

  useEffect(() => {
    // 1. Zalgo Corruption Loop
    const interval = setInterval(() => {
      const persona = (useMoodStore.getState().mascot.emotion || 'DEFAULT').toUpperCase();
      if (!SCRAMBLE_PERSONAS.has(persona)) return;

      const chatMessages = document.querySelectorAll(chatSelector);
      chatMessages.forEach((el) => {
        // Only corrupt older messages periodically
        if (Math.random() > 0.85) {
           const htmlEl = el as HTMLElement;
           const originalText = htmlEl.getAttribute('data-original-text') || htmlEl.innerText;
           if (!htmlEl.getAttribute('data-original-text')) {
              htmlEl.setAttribute('data-original-text', originalText);
           }
           
           // Glitch: corrupt then restore occasionally
           htmlEl.innerText = corrupt(originalText, 0.4);
           setTimeout(() => {
              if (Math.random() > 0.3) htmlEl.innerText = originalText;
           }, 200);
        }
      });
    }, 1500);

    // 2. Button Dodge Mechanic
    const handleMouseMove = (e: MouseEvent) => {
      const persona = (useMoodStore.getState().mascot.emotion || 'DEFAULT').toUpperCase();
      if (!DODGE_PERSONAS.has(persona)) return;

      const targets = document.querySelectorAll('[data-dodge="true"]');
      targets.forEach((target) => {
        const el = target as HTMLElement;
        const rect = el.getBoundingClientRect();
        
        // Calculate distance from mouse to center of button
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt(Math.pow(e.clientX - cx, 2) + Math.pow(e.clientY - cy, 2));

        const dodgeRadius = 120; // 120px radius
        if (dist < dodgeRadius) {
          // Teleport away!
          const angle = Math.atan2(e.clientY - cy, e.clientX - cx) + Math.PI + (Math.random() - 0.5);
          const moveDist = dodgeRadius * 1.5;
          const tx = Math.cos(angle) * moveDist;
          const ty = Math.sin(angle) * moveDist;

          el.style.transform = `translate(${tx}px, ${ty}px)`;
          el.style.transition = 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.filter = 'hue-rotate(90deg) brightness(1.5)';
        } else {
             // Return to base (slowly)
             const currentTransform = el.style.transform;
             if (currentTransform && currentTransform !== 'translate(0px, 0px)') {
                 el.style.transform = 'translate(0px, 0px)';
                 el.style.transition = 'transform 1s ease-out';
                 el.style.filter = 'none';
             }
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [chatSelector]);

  return null;
};
