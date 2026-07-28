<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createSceneRuntime, type RiveLikeModule, type SceneRuntime } from '../../scene/sceneRuntime';

// Ecran d'une scene Rive (contrat spec §3) : un canvas, un input `progress`.
// Le runtime (~wasm) n'est charge qu'ici, en import dynamique : les soirees
// sans scene ne le paient pas. Toute defaillance emet `failed` — l'ecran
// retombe alors sur le visuel none, jamais de crash en soiree (spec §6).

const props = defineProps<{ sceneUrl: string; progress: number }>();
const emit = defineEmits<{ failed: [] }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let runtime: SceneRuntime | null = null;

function teardown(): void {
  runtime?.destroy();
  runtime = null;
}

onMounted(async () => {
  if (!canvasRef.value) {
    emit('failed');
    return;
  }
  try {
    const riveModule = (await import('@rive-app/canvas')) as unknown as RiveLikeModule;
    runtime = createSceneRuntime({
      module: riveModule,
      canvas: canvasRef.value,
      src: props.sceneUrl,
      onError: () => {
        teardown();
        emit('failed');
      }
    });
    runtime.setProgress(props.progress);
  } catch (loadFailure) {
    console.warn('Scene runtime unavailable:', loadFailure);
    teardown();
    emit('failed');
  }
});

watch(() => props.progress, (value) => {
  runtime?.setProgress(value);
});

onBeforeUnmount(teardown);
</script>

<template>
  <canvas ref="canvasRef" class="scene-canvas" aria-hidden="true"></canvas>
</template>

<style scoped>
.scene-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
