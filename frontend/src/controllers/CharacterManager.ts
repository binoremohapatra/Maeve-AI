import { MainCharacterController } from './MainCharacterController';
import { HumanAnimationController } from './HumanAnimationController';

export class CharacterManager {
  private main: MainCharacterController;
  private active: MainCharacterController;

  constructor(mainCtrl: MainCharacterController) {
    this.main = mainCtrl;
    this.active = this.main;
    this.main.show();

    setTimeout(() => {
      this.play("IDLE");
    }, 100);
  }

  public setMainController(ctrl: MainCharacterController) {
    if (this.main && this.main.dispose) this.main.dispose();
    this.main = ctrl;
    this.active = ctrl;
    ctrl.show();
  }

  public getMainController() {
    return this.main;
  }

  public play = (actionName: string, emotion?: string) => {
    const normalized = (actionName || "").trim().toUpperCase();
    this.active.play(actionName, emotion);
  }

  public update = (delta: number) => {
    this.active.update(delta);
  }

  public getActiveController = () => {
    return this.active;
  }

  public handleServerResponse = (data: any) => {
    // 1. Play Body Animation
    if (data.mascotAction) {
      this.play(data.mascotAction);
    }

    // 2. Apply Facial Emotion
    if (data.emotion && (this.active as any).animationController) {
      const animCtrl = (this.active as any).animationController as HumanAnimationController;
      animCtrl.applyFacialEmotion(data.emotion);
      // Ensure Anime Persona Engine is also triggered for advanced expressions
      animCtrl.applyAnimePersonaFace(data.emotion, 1.0);
    }

    if (data.audioBase64) {
      if (this.active && (this.active as any).animationController) {
        (this.active as any).animationController.handleServerResponse(data);
      }
    }
  }
}
