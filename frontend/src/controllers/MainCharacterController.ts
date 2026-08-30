import { VRM } from "@pixiv/three-vrm";
import { HumanAnimationController } from "./HumanAnimationController";

export class MainCharacterController {
  public vrm: VRM;
  public animationController: HumanAnimationController;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.animationController = new HumanAnimationController(vrm, false);

    //  Face Material Enhancement
    this.vrm.scene.traverse((obj: any) => {
      if (obj.isMesh && obj.name.toLowerCase().includes("face")) {
        if (obj.material) {
          obj.material.roughness = 0.45;
          obj.material.metalness = 0;
          obj.material.emissiveIntensity = 0.05;
        }
      }
    });
  }

  show() { this.vrm.scene.visible = true; }
  hide() { this.vrm.scene.visible = false; }

  play(actionName: string, emotion?: string) {
    console.log(" Main Controller Playing:", actionName);



    this.animationController.playAnimation(actionName);

    // Apply emotion if provided
    if (emotion) {
      this.animationController.applyFacialEmotion(emotion);
    }
  }

  update(delta: number) {
    this.animationController.update(delta);
  }

  dispose() {
    console.log(" Disposing MainCharacterController");
    this.animationController.dispose();
  }



  //  Expression Preset: SoftBreathFace
  activateSoftBreathFace(intensity: number = 1) {
    this.animationController.activateSoftBreathFace(intensity);
  }

  //  Add Subtle Breath Motion (Makes It Alive)
  activateSoftBreathFaceDynamic() {
    this.animationController.activateSoftBreathFaceDynamic();
  }



  //  Dramatic Open Mouth Expression (Non-Explicit)
  // For shouting, wild laughter, battle scream, playful teasing, etc.
  activateDramaticOpenMouthFace(intensity: number = 1) {
    this.animationController.activateDramaticOpenMouthFace(intensity);
  }

  //  Preset: DominantRoarFace
  // Intense dominant open-mouth expression (battle scream / powerful shout / commanding presence)
  activateDominantRoarFace(intensity: number = 1) {
    this.animationController.activateDominantRoarFace(intensity);
  }

  //  Add Power Pulse (Optional)
  activateDominantRoarFaceDynamic() {
    this.animationController.activateDominantRoarFaceDynamic();
  }
}
