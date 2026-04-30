import { EffectComposer } from '@react-three/postprocessing';
import { useMoodStore } from '../../stores/moodStore';
import { LustVibe, AngryVibe, SadVibe, HappyVibe, YanderePsychoVibe } from './VibeLibrary';

export const PostProcessingEngine = ({ isLowEnd }: { isLowEnd: boolean }) => {
  const { mascot } = useMoodStore();
  const emotionKey = (mascot?.emotion || 'NEUTRAL').toUpperCase();

  const isIntimate = ['SEXY', 'LUST', 'PLEASURE', 'ROMANCE', 'KISS', 'HUGGINGKISS'].includes(emotionKey);
  const isDanger = ['ANGRY', 'DISGUST', 'TSUNDERE'].includes(emotionKey); // YANDERE removed
  const isPsycho = ['YANDERE', 'PSYCHO', 'DESTROY'].includes(emotionKey); // The new Deep-Fried Horror group
  const isIsolation = ['SAD', 'LONELY', 'HURT', 'FEAR', 'DANDERE'].includes(emotionKey);
  const isHappy = ['HAPPY', 'JOY', 'FUN'].includes(emotionKey);

  const ms = isLowEnd ? 0 : 4;

  // Safely return isolated composers to prevent WebGL pipeline corruption
  if (isIntimate) return <EffectComposer enableNormalPass={false} multisampling={ms}><LustVibe isLowEnd={isLowEnd} /></EffectComposer>;
  if (isDanger) return <EffectComposer enableNormalPass={false} multisampling={ms}><AngryVibe isLowEnd={isLowEnd} /></EffectComposer>;
  if (isPsycho) return <EffectComposer enableNormalPass={false} multisampling={ms}><YanderePsychoVibe isLowEnd={isLowEnd} /></EffectComposer>;
  if (isIsolation) return <EffectComposer enableNormalPass={false} multisampling={ms}><SadVibe isLowEnd={isLowEnd} /></EffectComposer>;
  if (isHappy) return <EffectComposer enableNormalPass={false} multisampling={ms}><HappyVibe isLowEnd={isLowEnd} /></EffectComposer>;

  return null;
};
