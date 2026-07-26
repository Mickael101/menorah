<script setup lang="ts">
import { useToast } from '../../composables/useToast';

const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" role="status" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast-${toast.kind}`"
        >
          <svg v-if="toast.kind === 'success'" class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
          <svg v-else-if="toast.kind === 'error'" class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <svg v-else class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>

          <span class="toast-message">{{ toast.message }}</span>

          <button type="button" class="toast-close" aria-label="×" @click="dismiss(toast.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 24px;
  inset-inline-end: 24px;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 260px;
  max-width: min(420px, calc(100vw - 48px));
  padding: 13px 14px;
  border: 1px solid;
  border-radius: var(--radius-md);
  background: white;
  box-shadow: var(--shadow-xl);
  font-size: 14px;
  font-weight: 500;
  pointer-events: auto;
}

.toast-success {
  border-color: var(--success-500);
  background: var(--success-50);
  color: var(--success-600);
}

.toast-error {
  border-color: var(--error-500);
  background: var(--error-50);
  color: var(--error-600);
}

.toast-info {
  border-color: var(--primary-300);
  background: var(--primary-50);
  color: var(--primary-700);
}

.toast-icon {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: currentColor;
  opacity: 0.55;
  cursor: pointer;
  transition: var(--transition-fast);
}

.toast-close:hover {
  opacity: 1;
  background: rgb(0 0 0 / 0.06);
}

.toast-close svg {
  width: 13px;
  height: 13px;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--transition), transform var(--transition);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

@media (max-width: 600px) {
  .toast-stack {
    inset-inline: 12px;
    bottom: 12px;
  }

  .toast {
    min-width: 0;
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity var(--transition-fast);
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
