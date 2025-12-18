<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Donation } from '../../composables/useDonations';

const props = defineProps<{
  donation: Donation | null;
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'animationEnd'): void;
}>();

// Seuils en centimes
const THRESHOLDS = {
  GOLD: 7200000,
  DIAMOND: 3600000,
  BRONZE: 2600000,
};

function getPlateColor(amount: number): string {
  if (amount >= THRESHOLDS.GOLD) return 'gold';
  if (amount >= THRESHOLDS.DIAMOND) return 'diamond';
  return 'bronze';
}

function formatAmount(cents: number): string {
  const shekels = cents / 100;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(shekels);
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    // Auto-hide after 4 seconds
    setTimeout(() => {
      emit('animationEnd');
    }, 4000);
  }
});
</script>

<template>
  <Transition name="plate-anim">
    <div v-if="show && donation" class="plate-animation-container">
      <!-- Dark overlay -->
      <div class="plate-overlay"></div>

      <!-- Explosion rings -->
      <div class="explosion-rings">
        <div class="ring ring-1"></div>
        <div class="ring ring-2"></div>
        <div class="ring ring-3"></div>
      </div>

      <!-- Particles -->
      <div class="explosion-particles">
        <span v-for="i in 30" :key="i" class="particle"></span>
      </div>

      <!-- The plate itself -->
      <div class="plate-showcase" :class="getPlateColor(donation.amount)">
        <div class="plate-glow"></div>
        <div class="plate-content">
          <div class="donor-name">{{ donation.firstName }} {{ donation.lastName }}</div>
          <div class="donor-amount">{{ formatAmount(donation.amount) }}</div>
        </div>
      </div>

      <!-- Celebration text -->
      <div class="celebration-text">NOUVEAU DON !</div>
    </div>
  </Transition>
</template>

<style scoped>
.plate-animation-container {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 30px;
  pointer-events: none;
}

.plate-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255, 215, 0, 0.2) 0%, rgba(0, 0, 0, 0.85) 70%);
  animation: overlay-fade 0.4s ease-out;
}

@keyframes overlay-fade {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* Explosion Rings */
.explosion-rings {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 4px solid rgba(255, 215, 0, 0.8);
  border-radius: 50%;
  animation: ring-expand 2s ease-out forwards;
}

.ring-1 { animation-delay: 0ms; }
.ring-2 { animation-delay: 200ms; }
.ring-3 { animation-delay: 400ms; }

@keyframes ring-expand {
  0% { width: 50px; height: 50px; opacity: 1; border-width: 4px; }
  100% { width: 150vw; height: 150vw; opacity: 0; border-width: 1px; }
}

/* Particles */
.explosion-particles {
  position: absolute;
  top: 50%;
  left: 50%;
}

.particle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border-radius: 50%;
  box-shadow: 0 0 15px #FFD700;
  animation: particle-explode 2s ease-out forwards;
}

.particle:nth-child(1) { --angle: 0deg; --dist: 350px; animation-delay: 0ms; }
.particle:nth-child(2) { --angle: 12deg; --dist: 400px; animation-delay: 30ms; }
.particle:nth-child(3) { --angle: 24deg; --dist: 320px; animation-delay: 60ms; }
.particle:nth-child(4) { --angle: 36deg; --dist: 380px; animation-delay: 90ms; }
.particle:nth-child(5) { --angle: 48deg; --dist: 420px; animation-delay: 120ms; }
.particle:nth-child(6) { --angle: 60deg; --dist: 340px; animation-delay: 150ms; }
.particle:nth-child(7) { --angle: 72deg; --dist: 390px; animation-delay: 180ms; }
.particle:nth-child(8) { --angle: 84deg; --dist: 360px; animation-delay: 210ms; }
.particle:nth-child(9) { --angle: 96deg; --dist: 410px; animation-delay: 240ms; }
.particle:nth-child(10) { --angle: 108deg; --dist: 330px; animation-delay: 270ms; }
.particle:nth-child(11) { --angle: 120deg; --dist: 400px; animation-delay: 300ms; }
.particle:nth-child(12) { --angle: 132deg; --dist: 350px; animation-delay: 330ms; }
.particle:nth-child(13) { --angle: 144deg; --dist: 420px; animation-delay: 360ms; }
.particle:nth-child(14) { --angle: 156deg; --dist: 340px; animation-delay: 390ms; }
.particle:nth-child(15) { --angle: 168deg; --dist: 380px; animation-delay: 420ms; }
.particle:nth-child(16) { --angle: 180deg; --dist: 360px; animation-delay: 450ms; }
.particle:nth-child(17) { --angle: 192deg; --dist: 400px; animation-delay: 480ms; }
.particle:nth-child(18) { --angle: 204deg; --dist: 320px; animation-delay: 510ms; }
.particle:nth-child(19) { --angle: 216deg; --dist: 410px; animation-delay: 540ms; }
.particle:nth-child(20) { --angle: 228deg; --dist: 370px; animation-delay: 570ms; }
.particle:nth-child(21) { --angle: 240deg; --dist: 430px; animation-delay: 600ms; }
.particle:nth-child(22) { --angle: 252deg; --dist: 345px; animation-delay: 630ms; }
.particle:nth-child(23) { --angle: 264deg; --dist: 395px; animation-delay: 660ms; }
.particle:nth-child(24) { --angle: 276deg; --dist: 355px; animation-delay: 690ms; }
.particle:nth-child(25) { --angle: 288deg; --dist: 405px; animation-delay: 720ms; }
.particle:nth-child(26) { --angle: 300deg; --dist: 335px; animation-delay: 750ms; }
.particle:nth-child(27) { --angle: 312deg; --dist: 395px; animation-delay: 780ms; }
.particle:nth-child(28) { --angle: 324deg; --dist: 365px; animation-delay: 810ms; }
.particle:nth-child(29) { --angle: 336deg; --dist: 415px; animation-delay: 840ms; }
.particle:nth-child(30) { --angle: 348deg; --dist: 375px; animation-delay: 870ms; }

@keyframes particle-explode {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  30% { transform: translate(calc(cos(var(--angle)) * calc(var(--dist) * 0.3)), calc(sin(var(--angle)) * calc(var(--dist) * 0.3))) scale(1.5); opacity: 1; }
  100% { transform: translate(calc(cos(var(--angle)) * var(--dist)), calc(sin(var(--angle)) * var(--dist))) scale(0); opacity: 0; }
}

/* The Plate */
.plate-showcase {
  position: relative;
  z-index: 10;
  width: 80vw;
  max-width: 900px;
  padding: 40px 60px;
  border-radius: 15px;
  animation: plate-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes plate-entrance {
  0% { transform: scale(0) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(3deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.plate-showcase.gold {
  background: #FFD700;
}

.plate-showcase.diamond {
  background: #E8E8E8;
}

.plate-showcase.bronze {
  background: #CD7F32;
}

.plate-glow {
  position: absolute;
  inset: -20px;
  border-radius: 25px;
  z-index: -1;
  animation: plate-glow 1s ease-in-out infinite alternate;
}

.plate-showcase.gold .plate-glow {
  background: radial-gradient(ellipse, rgba(255, 215, 0, 0.6) 0%, transparent 70%);
  box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 165, 0, 0.5);
}

.plate-showcase.diamond .plate-glow {
  background: radial-gradient(ellipse, rgba(200, 200, 255, 0.6) 0%, transparent 70%);
  box-shadow: 0 0 60px rgba(200, 200, 255, 0.8), 0 0 120px rgba(150, 150, 200, 0.5);
}

.plate-showcase.bronze .plate-glow {
  background: radial-gradient(ellipse, rgba(205, 127, 50, 0.6) 0%, transparent 70%);
  box-shadow: 0 0 60px rgba(205, 127, 50, 0.8), 0 0 120px rgba(180, 100, 30, 0.5);
}

@keyframes plate-glow {
  0% { opacity: 0.8; transform: scale(1); }
  100% { opacity: 1; transform: scale(1.05); }
}

.plate-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.donor-name {
  font-family: 'Cinzel', 'Arial Black', sans-serif;
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 900;
  color: #1a1400;
  text-transform: uppercase;
  letter-spacing: 4px;
}

.donor-amount {
  font-family: 'Cinzel', 'Arial Black', sans-serif;
  font-size: clamp(1.8rem, 4vw, 3.5rem);
  font-weight: 900;
  color: #1a1400;
  white-space: nowrap;
}

/* Celebration text */
.celebration-text {
  position: relative;
  z-index: 10;
  font-family: 'Cinzel', 'Arial Black', sans-serif;
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  font-weight: 900;
  color: #FFD700;
  text-transform: uppercase;
  letter-spacing: 8px;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 165, 0, 0.5);
  animation: text-pulse 0.8s ease-in-out infinite alternate;
}

@keyframes text-pulse {
  0% { opacity: 0.8; transform: scale(1); }
  100% { opacity: 1; transform: scale(1.05); }
}

/* Transitions */
.plate-anim-enter-active {
  animation: container-in 0.3s ease-out;
}

.plate-anim-leave-active {
  animation: container-out 0.5s ease-in;
}

@keyframes container-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes container-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
