<script setup lang="ts">
import { watch, onMounted } from 'vue';
import { useDonations } from './composables/useDonations';

const { config, fetchConfig } = useDonations();

// Keep the browser tab title in sync with the admin-configured text.
// Falls back to the organization name, then a neutral default, so an
// empty field never leaves the tab blank.
watch(
  () => {
    const texts = config.value.displaySettings.texts;
    return texts.browserTitle?.trim() || texts.organizationName?.trim() || 'Dons en direct';
  },
  (title) => {
    document.title = title;
  },
  { immediate: true }
);

onMounted(() => {
  // Ensure the title reflects live config even on pages that don't fetch it.
  fetchConfig();
});
</script>

<template>
  <router-view />
</template>

<style>
#app {
  min-height: 100vh;
}
</style>
