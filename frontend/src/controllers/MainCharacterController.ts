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

    // Blocking adult actions
    const adultActions = ["BLOWJOB", "BACKSHOT", "MASTURBATE", "AHEGAO", "FRONT", "FRONT2", "FRONTSLOW"];
    if (adultActions.some(a => actionName.includes(a))) return;

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

  //  STEP 1 — Expression Blend Setup
  activatePleasureFace(intensity: number = 1) {
    this.animationController.activatePleasureFace(intensity);
  }

  //  Advanced Version (Breathing Variation)
  activatePleasureFaceDynamic() {
    this.animationController.activatePleasureFaceDynamic();
  }

  //  Preset Name: WildExcitedFace
  activateWildExcitedFace(intensity: number = 1) {
    this.animationController.activateWildExcitedFace(intensity);
  }

  //  Optional: Subtle Intensity Pulse
  activateWildExcitedFaceDynamic() {
    this.animationController.activateWildExcitedFaceDynamic();
  }

  //  OVERWHELMED / INTENSE FACE PRESET
  activateOverwhelmedFace(intensity: number = 1) {
    this.animationController.activateOverwhelmedFace(intensity);
  }

  //  Make It Dynamic (More Realistic)
  activateOverwhelmedFaceDynamic() {
    this.animationController.activateOverwhelmedFaceDynamic();
  }

  //  Expression Preset: SoftBreathFace
  activateSoftBreathFace(intensity: number = 1) {
    this.animationController.activateSoftBreathFace(intensity);
  }

  //  Add Subtle Breath Motion (Makes It Alive)
  activateSoftBreathFaceDynamic() {
    this.animationController.activateSoftBreathFaceDynamic();
  }

  //  Preset Name: FocusedTeaseFace
  // Intense focused / dominant / teasing facial preset
  activateFocusedTeaseFace(intensity: number = 1) {
    this.animationController.activateFocusedTeaseFace(intensity);
  }

  //  Add Micro Intensity Pulse
  activateFocusedTeaseFaceDynamic() {
    this.animationController.activateFocusedTeaseFaceDynamic();
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
