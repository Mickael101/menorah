<script setup lang="ts">
// /display-light — variante LED geant, police XXL. Enveloppe mince (C3).
import DisplayScreen from '../components/display/DisplayScreen.vue';
import { LIGHT_VARIANT } from '../components/display/displayVariants';
</script>

<template>
  <DisplayScreen :variant="LIGHT_VARIANT" />
</template>
