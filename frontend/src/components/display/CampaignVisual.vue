<script setup lang="ts">
import MenorahDisplay from './MenorahDisplay.vue';
import type { DisplayVisualMode } from '../../composables/useDonations';

defineProps<{
  mode: DisplayVisualMode;
  customSvgUrl?: string | null;
}>();
</script>

<template>
  <div class="campaign-visual" :class="`visual-${mode}`">
    <MenorahDisplay v-if="mode === 'menorah'" />
    <img
      v-else-if="mode === 'custom' && customSvgUrl"
      :src="customSvgUrl"
      class="custom-visual"
      alt="Visuel personnalisé de la campagne"
    />
  </div>
</template>

<style scoped>
.campaign-visual {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
}

.campaign-visual :deep(.menorah-display),
.campaign-visual :deep(.menorah-svg) {
  width: 100%;
  height: 100%;
}

.campaign-visual :deep(.menorah-svg svg),
.custom-visual {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.custom-visual {
  padding: clamp(12px, 2vw, 34px);
  box-sizing: border-box;
  filter: drop-shadow(0 18px 42px rgba(0, 0, 0, 0.3));
}
</style>
