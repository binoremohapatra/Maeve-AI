import { MainCharacterController } from './MainCharacterController';
import { AdultCharacterController } from './AdultCharacterController';
import { HumanAnimationController } from './HumanAnimationController';

export class CharacterManager {
  private main: MainCharacterController;
  private adult: AdultCharacterController;
  private active: MainCharacterController | AdultCharacterController;

  constructor(mainCtrl: MainCharacterController, adultCtrl: AdultCharacterController) {
    this.main = mainCtrl;
    this.adult = adultCtrl;
    this.active = this.main;
    this.main.show();
    this.adult.hide();

    setTimeout(() => {
      this.play("IDLE");
    }, 100);
  }

  public setMainController(ctrl: MainCharacterController) {
    if (this.main && this.main.dispose) this.main.dispose();
    this.main = ctrl;
    if (this.active === this.main) {
      this.active = ctrl;
      ctrl.show();
    } else {
      ctrl.hide();
    }
  }

  public setAdultController(ctrl: AdultCharacterController) {
    if (this.adult && (this.adult as any).dispose) (this.adult as any).dispose();
    this.adult = ctrl;
    if (this.active === this.adult) {
      this.active = ctrl;
      ctrl.show();
    } else {
      ctrl.hide();
    }
  }

  public getMainController() {
    return this.main;
  }

  public getAdultController() {
    return this.adult;
  }

  private switchToMain = () => {
    if (this.active === this.main) return;

    this.adult.hide();
    this.main.show();
    this.active = this.main;
  }

  private switchToAdult = () => {
    if (this.active === this.adult) return;

    // console.log(" Switching to ADULT");

    this.main.hide();
    this.adult.show();
    this.active = this.adult;
  }

  public play = (actionName: string, emotion?: string) => {
    const normalized = (actionName || "").trim().toUpperCase();
    // console.log(` Character Manager [${normalized}] - Current Active: ${this.active === this.main ? "MAIN" : "ADULT"}`);

    const adultActions = [
      "BLOWJOB", "BACKSHOT", "MASTURBATE", "FRONT", "AHEGAO", "SEXY"
    ];

    // Check if the action name contains any of our adult keywords
    const isAdult = adultActions.some(a => normalized.includes(a));

    if (isAdult) {
      this.switchToAdult();
    } else {
      this.switchToMain();
    }

    this.active.play(actionName, emotion);
  }

  public playInteractionSequence = (baseName: string) => {
    this.switchToAdult();
    const animCtrl = (this.active as any).animationController as HumanAnimationController;
    if (animCtrl) {
      animCtrl.playSequence(baseName);
    }
  }

  public endInteraction = () => {
    const animCtrl = (this.active as any).animationController as HumanAnimationController;
    if (animCtrl) {
      animCtrl.triggerEndAction();
    }
  }

  public update = (delta: number) => {
    this.active.update(delta);
  }

  public getActiveController = () => {
    return this.active;
  }

  public handleServerResponse = (data: any) => {
    // console.log(" CharacterManager handling server response:", data);

    // 1. Play Body Animation
    if (data.mascotAction) {
      this.play(data.mascotAction);
    }

    // 2.  NEW: Apply Facial Emotion
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
