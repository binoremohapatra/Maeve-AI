import { useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const ResponsiveBackground = () => {
  const texture = useLoader(THREE.TextureLoader, '/final_studio_bg.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  const imageAspectRatio = texture.image.width / texture.image.height;

  const { viewport, camera } = useThree();
  
  //  इमेज की डेप्थ (इसे Maeve के पीछे -10 पर सेट कर रहे हैं)
  const planeZ = -10;

  const scale = useMemo(() => {
    // इस डेप्थ पर स्क्रीन का असली साइज क्या है, ये निकालो
    const currentViewport = viewport.getCurrentViewport(camera, [0, 0, planeZ]);
    const viewportAspectRatio = currentViewport.width / currentViewport.height;

    // CSS 'background-size: cover' वाला लॉजिक
    if (viewportAspectRatio > imageAspectRatio) {
      // स्क्रीन ज्यादा चौड़ी है
      return [currentViewport.width, currentViewport.width / imageAspectRatio, 1];
    } else {
      // स्क्रीन ज्यादा लंबी है (मोबाइल)
      return [currentViewport.height * imageAspectRatio, currentViewport.height, 1];
    }
  }, [viewport, camera, imageAspectRatio, planeZ]);

  return (
    <mesh position={[0, 0, planeZ]} scale={scale as any}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial 
        map={texture} 
        transparent={false} // पारदर्शी नहीं होना चाहिए ताकि तारे छुप जाएं
        depthTest={false}   // ये हमेशा पीछे रहेगा
        toneMapped={false}  // असली रंग दिखेंगे
      />
    </mesh>
  );
};
