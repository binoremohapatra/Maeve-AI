import { useRef, useCallback } from "react";
// @ts-ignore
import { damp } from "maath/easing";
import type { RootState } from "@react-three/fiber";
import type { Group } from "three";

type TurnState = "IDLE" | "SHIFTING" | "TURNING";

interface AwarenessMachineState {
  phase: TurnState;
  targetAngle: number;
  shiftTimer: number;
  triggerAngle: number;
}

const TRIGGER_THRESHOLD_RAD  = 1.4;
const SETTLE_THRESHOLD_RAD   = 0.09;
const WEIGHT_SHIFT_DELAY_S   = 0.25;
const TURN_DAMP_LAMBDA       = 4.5;
const COMFORT_OFFSET_RAD     = 0.12;

function shortestAngleDiff(current: number, target: number): number {
  return ((target - current) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
}

function wrapAngle(angle: number): number {
  return ((angle % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
}

export function useAwarenessTurnEngine() {
  const machine = useRef<AwarenessMachineState>({
    phase: "IDLE",
    targetAngle: 0,
    shiftTimer: 0,
    triggerAngle: 0,
  });

  const onTick = useCallback((
    state: RootState,
    delta: number,
    group: Group | null,
    manager: any | null,
    isBusy: boolean //  THE FIX: लॉक ताकि बेड पर ना घूमे
  ): void => {

    if (!group || !manager || isBusy) return;

    const cam = state.camera;
    const m = machine.current;

    const camX = cam.position.x - group.position.x;
    const camZ = cam.position.z - group.position.z;
    const cameraAngle = Math.atan2(camX, camZ); 
    const currentY = group.rotation.y;
    const angleDiff = shortestAngleDiff(currentY, cameraAngle);

    switch (m.phase) {
      case "IDLE": {
        if (Math.abs(angleDiff) > TRIGGER_THRESHOLD_RAD) {
          const comfortBias = Math.sign(angleDiff) * COMFORT_OFFSET_RAD;
          m.targetAngle = wrapAngle(cameraAngle - comfortBias);
          m.triggerAngle = cameraAngle;
          m.shiftTimer = WEIGHT_SHIFT_DELAY_S;
          m.phase = "SHIFTING";
          manager.play("WEIGHT_SHIFT");
        }
        break;
      }
      case "SHIFTING": {
        // अगर कैमरा वापस सामने आ गया, तो मुड़ना कैंसिल
        if (Math.abs(angleDiff) <= TRIGGER_THRESHOLD_RAD * 0.7) {
          m.phase = "IDLE";
          manager.play("IDLE");
          break;
        }

        m.shiftTimer -= delta;

        if (m.shiftTimer <= 0) {
          m.phase = "TURNING";
          manager.play("IDLE"); 
        }
        break;
      }
      case "TURNING": {
        if (Math.abs(angleDiff) > SETTLE_THRESHOLD_RAD) {
          const comfortBias = Math.sign(angleDiff) * COMFORT_OFFSET_RAD;
          m.targetAngle = wrapAngle(cameraAngle - comfortBias);
        }

        damp(group.rotation, "y", m.targetAngle, TURN_DAMP_LAMBDA, delta);

        const remaining = Math.abs(shortestAngleDiff(group.rotation.y, m.targetAngle));
        if (remaining < SETTLE_THRESHOLD_RAD) {
          group.rotation.y = m.targetAngle;
          m.phase = "IDLE";
        }
        break;
      }
    }
  }, []);

  return { onTick };
}
