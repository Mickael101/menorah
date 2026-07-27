<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type {
  Donation,
  DonationAnimationStyle,
  DisplayTextDirection
} from '../../composables/useDonations';
import { animateValue, easeOutQuart } from './animations';

const props = withDefaults(defineProps<{
  donation: Donation | null;
  show: boolean;
  animationStyle?: DonationAnimationStyle;
  thankYouTitle?: string;
  thankYouMessage?: string;
  textDirection?: DisplayTextDirection;
}>(), {
  animationStyle: 'prestige',
  thankYouTitle: 'Un grand merci',
  thankYouMessage: 'Votre générosité fait avancer la campagne',
  textDirection: 'auto'
});

const emit = defineEmits<{
  (e: 'animationEnd'): void;
}>();

const THRESHOLDS = {
  GOLD: 7200000,
  DIAMOND: 3600000
};

const displayedAmount = ref(0);
let autoHideTimer: number | null = null;
let amountDelayTimer: number | null = null;
let cancelAmount: (() => void) | null = null;

const fullName = computed(() => {
  if (!props.donation) return '';
  return `${props.donation.firstName} ${props.donation.lastName}`.trim();
});

const tierClass = computed(() => {
  const amount = props.donation?.amount ?? 0;
  if (amount >= THRESHOLDS.GOLD) return 'gold';
  if (amount >= THRESHOLDS.DIAMOND) return 'diamond';
  return 'bronze';
});

function formatAmount(cents: number): string {
  const hasAgorot = Math.abs(cents) % 100 !== 0;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: hasAgorot ? 2 : 0,
    maximumFractionDigits: hasAgorot ? 2 : 0
  }).format(cents / 100);
}

function clearAnimationTimers(): void {
  if (autoHideTimer !== null) window.clearTimeout(autoHideTimer);
  if (amountDelayTimer !== null) window.clearTimeout(amountDelayTimer);
  cancelAmount?.();
  autoHideTimer = null;
  amountDelayTimer = null;
  cancelAmount = null;
}

// Comptage anime du montant de la plaque. Tween centralise dans animations.ts
// (easeOutQuart, 950 ms) ; le saut sous prefers-reduced-motion est conserve.
function animateAmount(target: number): void {
  cancelAmount?.();
  cancelAmount = animateValue({
    from: 0,
    to: target,
    duration: 950,
    easing: easeOutQuart,
    onUpdate: (value) => { displayedAmount.value = value; }
  });
}

watch(
  () => [props.show, props.donation?.id] as const,
  ([show]) => {
    clearAnimationTimers();
    if (!show || !props.donation) return;

    displayedAmount.value = 0;
    amountDelayTimer = window.setTimeout(() => {
      animateAmount(props.donation?.amount ?? 0);
      amountDelayTimer = null;
    }, 420);

    autoHideTimer = window.setTimeout(() => {
      emit('animationEnd');
      autoHideTimer = null;
    }, 4000);
  }
);

onUnmounted(clearAnimationTimers);
</script>

<template>
  <Transition name="donation-moment">
    <div
      v-if="show && donation"
      class="donation-moment"
      :class="`animation-${animationStyle}`"
      :dir="textDirection"
    >
      <div class="moment-overlay"></div>
      <div class="moment-bloom"></div>
      <div class="moment-watermark" aria-hidden="true">{{ fullName }}</div>

      <div class="moment-rings" aria-hidden="true">
        <span class="moment-ring ring-one"></span>
        <span class="moment-ring ring-two"></span>
      </div>

      <div class="moment-particles" aria-hidden="true">
        <span v-for="i in 14" :key="i" class="moment-particle"></span>
      </div>

      <div class="moment-stage">
        <div class="moment-eyebrow">
          <span class="eyebrow-line"></span>
          <span :dir="textDirection">{{ thankYouTitle }}</span>
          <span class="eyebrow-line"></span>
        </div>

        <div class="showcase-plate" :class="tierClass">
          <span class="corner corner-top-left"></span>
          <span class="corner corner-top-right"></span>
          <span class="corner corner-bottom-left"></span>
          <span class="corner corner-bottom-right"></span>
          <div class="plate-light-sweep"></div>

          <div class="showcase-content">
            <div class="showcase-name">{{ fullName }}</div>
            <div class="showcase-amount">{{ formatAmount(displayedAmount) }}</div>
          </div>
        </div>

        <div class="moment-thanks" :dir="textDirection">{{ thankYouMessage }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.donation-moment {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  pointer-events: none;
  overflow: hidden;
  font-family: var(--theme-font-body, 'Inter', sans-serif);
}

.moment-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg-color, #070914) 88%, transparent);
  backdrop-filter: blur(8px);
  animation: overlay-enter 420ms ease-out both;
}

.moment-bloom {
  position: absolute;
  width: min(94vw, 1100px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--chart-primary-color) 25%, transparent), transparent 66%);
  animation: bloom-sequence 3.6s ease-out both;
}

.moment-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120vw;
  transform: translate(-50%, -50%);
  color: transparent;
  font-family: var(--theme-font-display, 'Poppins', sans-serif);
  font-size: clamp(5rem, 12vw, 12rem);
  font-weight: 900;
  line-height: 0.9;
  text-align: center;
  text-transform: uppercase;
  -webkit-text-stroke: 1px color-mix(in srgb, var(--header-text-color) 13%, transparent);
  opacity: 0;
  animation: watermark-sequence 3.5s 120ms ease-out both;
}

.moment-stage {
  position: relative;
  z-index: 5;
  display: flex;
  width: min(86vw, 980px);
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.moment-eyebrow {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--header-text-color);
  font-size: clamp(0.82rem, 1.35vw, 1.05rem);
  font-weight: 800;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  animation: eyebrow-enter 650ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.eyebrow-line {
  width: clamp(28px, 5vw, 72px);
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--header-text-color));
}

.eyebrow-line:last-child {
  transform: scaleX(-1);
}

.showcase-plate {
  --showcase-accent: var(--plate-bronze, #B67846);
  position: relative;
  width: 100%;
  min-height: clamp(170px, 24vh, 250px);
  display: grid;
  place-items: center;
  padding: clamp(34px, 5vw, 68px);
  border: 1px solid color-mix(in srgb, var(--showcase-accent) 52%, transparent);
  border-radius: calc(var(--theme-radius, 16px) * 1.15);
  background:
    linear-gradient(115deg, color-mix(in srgb, var(--showcase-accent) 10%, transparent), transparent 35%),
    var(--theme-plate-surface, linear-gradient(135deg, #202333, #0c0e1c));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 30px 90px rgba(0, 0, 0, 0.46),
    0 0 70px color-mix(in srgb, var(--showcase-accent) 18%, transparent);
  overflow: hidden;
  animation: plate-sequence 3.55s 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.showcase-plate.gold { --showcase-accent: var(--plate-gold); }
.showcase-plate.diamond { --showcase-accent: var(--plate-diamond); }
.showcase-plate.bronze { --showcase-accent: var(--plate-bronze); }

.showcase-plate::before,
.showcase-plate::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.showcase-plate::before {
  inset: 12px;
  border: 1px solid color-mix(in srgb, var(--showcase-accent) 18%, transparent);
  border-radius: calc(var(--theme-radius, 16px) * 0.75);
}

.showcase-plate::after {
  left: 8%;
  right: 8%;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--showcase-accent), transparent);
  box-shadow: 0 0 24px var(--showcase-accent);
}

.plate-light-sweep {
  position: absolute;
  inset: -30% -60%;
  transform: translateX(-65%) skewX(-18deg);
  background: linear-gradient(90deg, transparent 42%, rgba(255, 255, 255, 0.17), transparent 58%);
  animation: light-sweep 1.25s 620ms ease-out both;
}

.showcase-content {
  position: relative;
  z-index: 2;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: clamp(24px, 5vw, 70px);
}

.showcase-name,
.showcase-amount {
  font-family: var(--theme-font-display, 'Poppins', sans-serif);
  font-weight: 800;
}

.showcase-name {
  min-width: 0;
  color: var(--plate-text, #F8F3E8);
  font-size: clamp(2rem, 4.6vw, 4.4rem);
  line-height: 1.05;
  overflow-wrap: anywhere;
  text-transform: uppercase;
  letter-spacing: clamp(1px, 0.22vw, 4px);
  animation: content-enter 720ms 430ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.showcase-amount {
  flex-shrink: 0;
  color: var(--showcase-accent);
  font-size: clamp(1.8rem, 3.8vw, 3.7rem);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-shadow: 0 0 28px color-mix(in srgb, var(--showcase-accent) 30%, transparent);
  animation: content-enter 720ms 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.moment-thanks {
  color: color-mix(in srgb, var(--stats-text-color) 72%, transparent);
  font-size: clamp(0.9rem, 1.5vw, 1.15rem);
  letter-spacing: 0.14em;
  max-width: min(90vw, 920px);
  line-height: 1.5;
  text-align: center;
  white-space: pre-line;
  animation: thanks-enter 650ms 720ms ease-out both;
}

/* Four deliberately different announcement moods, selected in the admin. */
.animation-confetti .moment-overlay {
  background: color-mix(in srgb, var(--bg-color, #070914) 82%, transparent);
}

.animation-confetti .moment-particle {
  width: 9px;
  height: 15px;
  border-radius: 2px;
  background: var(--chart-primary-color);
  box-shadow: none;
}

.animation-confetti .moment-particle:nth-child(3n) {
  background: var(--chart-secondary-color);
}

.animation-confetti .moment-particle:nth-child(3n + 1) {
  background: var(--plate-gold);
}

.animation-confetti .showcase-plate {
  animation-name: confetti-plate-sequence;
  animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.animation-ribbons .moment-bloom {
  width: min(110vw, 1380px);
  background: conic-gradient(
    from 20deg,
    transparent,
    color-mix(in srgb, var(--chart-primary-color) 18%, transparent),
    transparent 28%,
    color-mix(in srgb, var(--chart-secondary-color) 18%, transparent),
    transparent 60%
  );
  animation-name: ribbon-bloom-sequence;
}

.animation-ribbons .moment-ring {
  width: 210px;
  height: 78px;
  border-width: 3px;
  border-color: color-mix(in srgb, var(--chart-primary-color) 64%, transparent);
  border-radius: 50%;
  animation-name: ribbon-expand;
}

.animation-ribbons .ring-two {
  border-color: color-mix(in srgb, var(--chart-secondary-color) 68%, transparent);
  animation-direction: reverse;
}

.animation-ribbons .moment-particle {
  width: 22px;
  height: 3px;
  border-radius: 999px;
}

.animation-minimal .moment-overlay {
  background: color-mix(in srgb, var(--bg-color, #070914) 72%, transparent);
  backdrop-filter: blur(3px);
}

.animation-minimal .moment-bloom,
.animation-minimal .moment-watermark,
.animation-minimal .moment-rings,
.animation-minimal .moment-particles,
.animation-minimal .plate-light-sweep {
  display: none;
}

.animation-minimal .showcase-plate {
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
  animation-name: minimal-plate-sequence;
  animation-timing-function: ease-in-out;
}

.animation-minimal .moment-eyebrow,
.animation-minimal .moment-thanks {
  letter-spacing: 0.08em;
}

.donation-moment[dir='rtl'] .moment-eyebrow,
.donation-moment[dir='rtl'] .moment-thanks {
  letter-spacing: 0.035em;
}

.corner {
  position: absolute;
  z-index: 3;
  width: 22px;
  height: 22px;
  border-color: var(--showcase-accent);
  opacity: 0.75;
}

.corner-top-left { top: 22px; left: 22px; border-top: 2px solid; border-left: 2px solid; }
.corner-top-right { top: 22px; right: 22px; border-top: 2px solid; border-right: 2px solid; }
.corner-bottom-left { bottom: 22px; left: 22px; border-bottom: 2px solid; border-left: 2px solid; }
.corner-bottom-right { right: 22px; bottom: 22px; border-right: 2px solid; border-bottom: 2px solid; }

.moment-rings,
.moment-particles {
  position: absolute;
  top: 50%;
  left: 50%;
}

.moment-ring {
  position: absolute;
  width: 120px;
  height: 120px;
  transform: translate(-50%, -50%);
  border: 1px solid color-mix(in srgb, var(--chart-primary-color) 55%, transparent);
  border-radius: 50%;
  animation: ring-expand 1.9s ease-out both;
}

.ring-two { animation-delay: 180ms; }

.moment-particle {
  --angle: 0deg;
  --distance: 340px;
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--chart-primary-color);
  box-shadow: 0 0 12px var(--chart-primary-color);
  animation: particle-drift 1.8s 180ms ease-out both;
}

.moment-particle:nth-child(2) { --angle: 26deg; --distance: 390px; }
.moment-particle:nth-child(3) { --angle: 52deg; --distance: 320px; }
.moment-particle:nth-child(4) { --angle: 78deg; --distance: 370px; }
.moment-particle:nth-child(5) { --angle: 104deg; --distance: 340px; }
.moment-particle:nth-child(6) { --angle: 130deg; --distance: 400px; }
.moment-particle:nth-child(7) { --angle: 156deg; --distance: 330px; }
.moment-particle:nth-child(8) { --angle: 182deg; --distance: 380px; }
.moment-particle:nth-child(9) { --angle: 208deg; --distance: 350px; }
.moment-particle:nth-child(10) { --angle: 234deg; --distance: 390px; }
.moment-particle:nth-child(11) { --angle: 260deg; --distance: 320px; }
.moment-particle:nth-child(12) { --angle: 286deg; --distance: 375px; }
.moment-particle:nth-child(13) { --angle: 312deg; --distance: 345px; }
.moment-particle:nth-child(14) { --angle: 338deg; --distance: 405px; }

@keyframes overlay-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bloom-sequence {
  0% { opacity: 0; transform: scale(0.35); }
  25%, 72% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.18); }
}

@keyframes watermark-sequence {
  0% { opacity: 0; transform: translate(-50%, -46%) scale(0.94); }
  22%, 74% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -54%) scale(1.04); }
}

@keyframes eyebrow-enter {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes plate-sequence {
  0% { opacity: 0; transform: translateY(38px) scale(0.94); filter: blur(7px); }
  16% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
  82% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-20px) scale(0.97); }
}

@keyframes confetti-plate-sequence {
  0% { opacity: 0; transform: scale(0.7) rotate(-2deg); filter: blur(4px); }
  18% { opacity: 1; transform: scale(1.035) rotate(0.5deg); filter: blur(0); }
  28%, 82% { opacity: 1; transform: scale(1) rotate(0); }
  100% { opacity: 0; transform: scale(0.96) translateY(-16px); }
}

@keyframes minimal-plate-sequence {
  0% { opacity: 0; transform: translateY(18px); }
  18%, 82% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12px); }
}

@keyframes ribbon-bloom-sequence {
  0% { opacity: 0; transform: scale(0.45) rotate(-18deg); }
  24%, 72% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.15) rotate(45deg); }
}

@keyframes ribbon-expand {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.35) rotate(-24deg); }
  18% { opacity: 0.8; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(8) rotate(38deg); }
}

@keyframes content-enter {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes thanks-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes light-sweep {
  from { transform: translateX(-65%) skewX(-18deg); }
  to { transform: translateX(65%) skewX(-18deg); }
}

@keyframes ring-expand {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  18% { opacity: 0.75; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(9); }
}

@keyframes particle-drift {
  0% { opacity: 0; transform: translate(0, 0) scale(0); }
  18% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% {
    opacity: 0;
    transform: translate(
      calc(cos(var(--angle)) * var(--distance)),
      calc(sin(var(--angle)) * var(--distance))
    ) scale(0.35);
  }
}

.donation-moment-enter-active { transition: opacity 220ms ease-out; }
.donation-moment-leave-active { transition: opacity 420ms ease-in; }
.donation-moment-enter-from,
.donation-moment-leave-to { opacity: 0; }

@media (max-width: 700px) {
  .moment-stage { width: 92vw; gap: 16px; }
  .showcase-plate { min-height: 210px; padding: 42px 25px; }
  .showcase-content { flex-direction: column; gap: 14px; text-align: center; }
  .showcase-name { font-size: clamp(1.7rem, 8vw, 2.8rem); }
  .showcase-amount { font-size: clamp(1.55rem, 7vw, 2.4rem); }
  .moment-eyebrow { gap: 10px; letter-spacing: 0.18em; }
  .moment-thanks { text-align: center; letter-spacing: 0.08em; }
}

@media (prefers-reduced-motion: reduce) {
  .moment-bloom,
  .moment-watermark,
  .moment-ring,
  .moment-particle,
  .plate-light-sweep,
  .moment-eyebrow,
  .showcase-plate,
  .showcase-name,
  .showcase-amount,
  .moment-thanks {
    animation: none !important;
  }

  .moment-ring,
  .moment-particle,
  .plate-light-sweep {
    display: none;
  }
}
</style>
