<script setup lang="ts">
// /display — ecran principal. Enveloppe mince : toute la logique est dans
// DisplayScreen.vue, la variante est decrite dans displayVariants.ts (C3).
import DisplayScreen from '../components/display/DisplayScreen.vue';
import { MAIN_VARIANT } from '../components/display/displayVariants';
</script>

<template>
  <DisplayScreen :variant="MAIN_VARIANT" />
</template>
