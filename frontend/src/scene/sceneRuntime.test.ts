import { describe, it, expect, vi } from 'vitest';
import { createSceneRuntime, type RiveLikeModule } from './sceneRuntime';

interface FakeParams {
  src: string;
  canvas: HTMLCanvasElement;
  autoplay: boolean;
  stateMachines: string;
  onLoad?: () => void;
  onLoadError?: () => void;
}

function makeFakeModule(inputs: Array<{ name: string; value: number | boolean }>) {
  const state = {
    params: null as FakeParams | null,
    cleanupCalls: 0,
    resizeCalls: 0
  };
  const module: RiveLikeModule = {
    Rive: class {
      constructor(params: FakeParams) {
        state.params = params;
      }
      stateMachineInputs(_name: string) {
        return inputs;
      }
      resizeDrawingSurfaceToCanvas() {
        state.resizeCalls += 1;
      }
      cleanup() {
        state.cleanupCalls += 1;
      }
    } as unknown as RiveLikeModule['Rive']
  };
  return { module, state };
}

const fakeCanvas = {} as HTMLCanvasElement;

describe('createSceneRuntime', () => {
  it('instancie Rive sur la state machine Scene avec autoplay', () => {
    const { module, state } = makeFakeModule([{ name: 'progress', value: 0 }]);
    createSceneRuntime({ module, canvas: fakeCanvas, src: '/uploads/scenes/x.riv' });
    expect(state.params?.stateMachines).toBe('Scene');
    expect(state.params?.autoplay).toBe(true);
    expect(state.params?.src).toBe('/uploads/scenes/x.riv');
  });

  it('applique le progress a l input apres onLoad, avec clamp 0-100', () => {
    const input = { name: 'progress', value: 0 };
    const { module, state } = makeFakeModule([input]);
    const runtime = createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv' });

    runtime.setProgress(160); // avant chargement : memorise, pas applique
    expect(input.value).toBe(0);

    state.params?.onLoad?.();
    expect(state.resizeCalls).toBe(1);
    expect(input.value).toBe(100); // valeur memorisee, clampee

    runtime.setProgress(-12);
    expect(input.value).toBe(0);
    runtime.setProgress(61.8);
    expect(input.value).toBe(61.8);
  });

  it('signale onError quand la state machine n expose pas l input progress', () => {
    const onError = vi.fn();
    const { module, state } = makeFakeModule([{ name: 'autreChose', value: 0 }]);
    createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv', onError });
    state.params?.onLoad?.();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('signale onError sur onLoadError (riv corrompu ou introuvable)', () => {
    const onError = vi.fn();
    const { module, state } = makeFakeModule([]);
    createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv', onError });
    state.params?.onLoadError?.();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('destroy nettoie l instance Rive et reste idempotent', () => {
    const { module, state } = makeFakeModule([{ name: 'progress', value: 0 }]);
    const runtime = createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv' });
    runtime.destroy();
    runtime.destroy();
    expect(state.cleanupCalls).toBe(1);
  });

  it('setProgress apres destroy est un no-op silencieux', () => {
    const input = { name: 'progress', value: 0 };
    const { module, state } = makeFakeModule([input]);
    const runtime = createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv' });
    state.params?.onLoad?.();
    runtime.destroy();
    runtime.setProgress(50);
    expect(input.value).toBe(0);
  });
});
