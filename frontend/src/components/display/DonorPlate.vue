<script setup lang="ts">
import { computed } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';

const props = defineProps<{
  donation: Donation;
  isNew?: boolean;
}>();

const { formatAmount } = useDonations();

const initials = computed(() => {
  return `${props.donation.firstName.charAt(0)}${props.donation.lastName.charAt(0)}`.toUpperCase();
});

// Generate a consistent color based on donation ID
const avatarHue = computed(() => {
  return (props.donation.id * 47) % 360;
});
</script>

<template>
  <div class="donor-plate" :class="{ 'is-new': isNew }">
    <!-- Glow effect for new donations -->
    <div class="plate-glow"></div>

    <!-- Main content -->
    <div class="plate-content">
      <div class="plate-avatar" :style="{ '--hue': avatarHue }">
        {{ initials }}
      </div>

      <div class="plate-info">
        <div class="plate-name">{{ donation.firstName }} {{ donation.lastName }}</div>
        <div class="plate-amount">{{ formatAmount(donation.amount) }}</div>
      </div>
    </div>

    <!-- Decorative border -->
    <div class="plate-border"></div>
  </div>
</template>

<style scoped>
.donor-plate {
  position: relative;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.donor-plate:hover {
  transform: translateY(-4px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
}

/* Animated border */
.plate-border {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* Glow effect */
.plate-glow {
  position: absolute;
  inset: -50%;
  background: radial-gradient(circle at center, rgba(100, 255, 218, 0.15) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.donor-plate:hover .plate-glow {
  opacity: 1;
}

/* Content */
.plate-content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 14px;
}

/* Avatar */
.plate-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    hsl(var(--hue, 220), 70%, 55%) 0%,
    hsl(calc(var(--hue, 220) + 40), 70%, 45%) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 15px hsla(var(--hue, 220), 70%, 50%, 0.3);
}

/* Info */
.plate-info {
  flex: 1;
  min-width: 0;
}

.plate-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.plate-amount {
  font-size: 16px;
  font-weight: 700;
  color: #64ffda;
  text-shadow: 0 0 10px rgba(100, 255, 218, 0.3);
}

/* New plate animations */
.donor-plate.is-new {
  animation: plate-entrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.donor-plate.is-new .plate-glow {
  animation: halo-glow 2s ease-out forwards;
}

.donor-plate.is-new .plate-border {
  animation: border-glow 2s ease-out;
}

@keyframes plate-entrance {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  50% {
    transform: scale(1.05) translateY(-5px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes halo-glow {
  0% {
    opacity: 1;
    transform: scale(0.8);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@keyframes border-glow {
  0%, 100% {
    background: linear-gradient(135deg, rgba(100, 255, 218, 0.5) 0%, rgba(139, 92, 246, 0.5) 50%, rgba(100, 255, 218, 0.5) 100%);
  }
  50% {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(100, 255, 218, 0.5) 50%, rgba(139, 92, 246, 0.5) 100%);
  }
}
</style>
