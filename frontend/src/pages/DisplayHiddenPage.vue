<script setup lang="ts">
// /display-hidden — variante sans file d'attente de dons. Enveloppe mince (C3).
import DisplayScreen from '../components/display/DisplayScreen.vue';
import { HIDDEN_VARIANT } from '../components/display/displayVariants';
</script>

<template>
  <DisplayScreen :variant="HIDDEN_VARIANT" />
</template>
