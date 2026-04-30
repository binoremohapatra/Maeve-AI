import { VRM } from "@pixiv/three-vrm";
import { HumanAnimationController } from "./HumanAnimationController";

export class AdultCharacterController {
  public vrm: VRM; // Private se public kiya taaki manager access kar sake
  public animationController: HumanAnimationController;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.animationController = new HumanAnimationController(vrm, true);
  }

  show() { this.vrm.scene.visible = true; }
  hide() { this.vrm.scene.visible = false; }

  play(actionName: string, emotion?: string) {
    console.log(" Adult Controller Playing:", actionName);

    // Play action (already classified as adult by CharacterManager)
    this.animationController.playAnimation(actionName);

    //  Face Sync: Agar backend se emotion nahi aaya, toh default SEXY apply karo
    this.animationController.applyFacialEmotion(emotion || "SEXUAL_DESIRE");
  }

  update(delta: number) {
    this.animationController.update(delta);
  }

  dispose() {
    console.log(" Disposing AdultCharacterController");
    this.animationController.dispose();
  }
}
