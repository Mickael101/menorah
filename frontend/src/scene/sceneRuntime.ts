// Controleur du contrat de scene (spec §3) : state machine `Scene`, un seul
// input number `progress` (0-100). Le runtime Rive est INJECTE pour rester
// testable sans canvas ni wasm ; SceneDisplay.vue fournit le vrai module via
// import dynamique.

export interface RiveLikeInstance {
  stateMachineInputs(name: string): Array<{ name: string; value: number | boolean }>;
  resizeDrawingSurfaceToCanvas(): void;
  cleanup(): void;
}

export interface RiveLikeModule {
  Rive: new (params: {
    src: string;
    canvas: HTMLCanvasElement;
    autoplay: boolean;
    stateMachines: string;
    onLoad?: () => void;
    onLoadError?: () => void;
  }) => RiveLikeInstance;
}

export interface SceneRuntime {
  setProgress(percent: number): void;
  destroy(): void;
}

const STATE_MACHINE = 'Scene';
const PROGRESS_INPUT = 'progress';

function clamp(percent: number): number {
  if (!Number.isFinite(percent)) {
    return 0;
  }
  return Math.min(100, Math.max(0, percent));
}

export function createSceneRuntime(options: {
  module: RiveLikeModule;
  canvas: HTMLCanvasElement;
  src: string;
  onError?: () => void;
}): SceneRuntime {
  let destroyed = false;
  let progressInput: { name: string; value: number | boolean } | null = null;
  // La valeur peut arriver avant onLoad (snapshot initial) : on la memorise
  // et on l'applique des que la state machine est prete.
  let pendingProgress = 0;

  const instance = new options.module.Rive({
    src: options.src,
    canvas: options.canvas,
    autoplay: true,
    stateMachines: STATE_MACHINE,
    onLoad: () => {
      if (destroyed) {
        return;
      }
      instance.resizeDrawingSurfaceToCanvas();
      const inputs = instance.stateMachineInputs(STATE_MACHINE) ?? [];
      progressInput = inputs.find((input) => input.name === PROGRESS_INPUT) ?? null;
      if (!progressInput) {
        options.onError?.();
        return;
      }
      progressInput.value = clamp(pendingProgress);
    },
    onLoadError: () => {
      if (!destroyed) {
        options.onError?.();
      }
    }
  });

  return {
    setProgress(percent: number): void {
      if (destroyed) {
        return;
      }
      pendingProgress = clamp(percent);
      if (progressInput) {
        progressInput.value = pendingProgress;
      }
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      progressInput = null;
      instance.cleanup();
    }
  };
}
