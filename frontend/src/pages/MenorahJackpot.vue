<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../composables/useDonations';
import { useSocket } from '../composables/useSocket';
import { useSoundEffects } from '../composables/useSoundEffects';

const { stats, donations, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();
const { playDonationSound, playAccomplissement, playTierTransition } = useSoundEffects();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');
const isLoaded = ref(false);

// Slot machine reels state
const reels = ref([
  { symbols: ['✡', '🕎', '💰', '⭐', '🔥'], current: 0, spinning: false },
  { symbols: ['✡', '🕎', '💰', '⭐', '🔥'], current: 1, spinning: false },
  { symbols: ['✡', '🕎', '💰', '⭐', '🔥'], current: 2, spinning: false },
]);
const jackpotActive = ref(false);
const showBigWin = ref(false);
const bigWinAmount = ref(0);
const coinExplosion = ref<Array<{ id: number; x: number; y: number; rotation: number }>>([]);
let nextCoinId = 0;

// Fireworks state
const fireworks = ref<Array<{ id: number; x: number; y: number; color: string }>>([]);
let nextFireworkId = 0;

// Seven segment display for amount
const displayAmount = ref(0);
const targetAmount = ref(0);

// Computed: Current tier
const currentTier = computed(() => {
  const percent = stats.value.percentComplete;
  if (percent === 100) return 5;
  if (percent >= 75) return 4;
  if (percent >= 50) return 3;
  if (percent >= 25) return 2;
  return 1;
});

const previousTier = ref(1);

// Tier names
const tierNames = ['', 'Bronze', 'Argent', 'Or', 'Platine', 'Diamant'];
const tierColors = ['', '#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF'];

// Format currency
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount);
}

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorahshiviti2.svg');
    svgContent.value = await response.text();

    setTimeout(() => {
      isLoaded.value = true;
      animateEntrance();
      startIdleAnimations();
      updateLighting();
    }, 100);
  } catch (error) {
    console.error('Failed to load menorah SVG:', error);
  }

  await Promise.all([fetchDonations(), fetchConfig()]);

  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    triggerSlotMachineAnimation(data.donation.amount);
  });

  on('donation:updated', (data: any) => {
    handleDonationUpdated(data.donation, data.stats);
  });

  on('donation:deleted', (data: any) => {
    handleDonationDeleted(data.donationId, data.stats);
  });

  on('config:updated', (data: any) => {
    handleConfigUpdated(data.config, data.stats);
  });
});

// Entrance animation
function animateEntrance(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.fromTo(svg,
    { opacity: 0, scale: 0.5, rotationY: -90 },
    {
      opacity: 1,
      scale: 1,
      rotationY: 0,
      duration: 2,
      ease: 'back.out(1.5)'
    }
  );

  // Animate display counter from 0
  gsap.to(displayAmount, {
    value: stats.value.totalAmount,
    duration: 3,
    ease: 'power2.out',
    onUpdate: () => {
      displayAmount.value = Math.floor(displayAmount.value);
    }
  });
}

// Idle animations
function startIdleAnimations(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Gentle floating
  gsap.to(svg, {
    y: -10,
    duration: 3,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
  });

  // Subtle glow pulse
  gsap.to('.menorah-glow', {
    opacity: 0.8,
    scale: 1.1,
    duration: 2,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
  });
}

// Update lighting based on progress
function updateLighting(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const elements = Array.from(svg.querySelectorAll('g[mask], svg > path')) as SVGGraphicsElement[];
  if (elements.length === 0) return;

  const sortedElements = elements.sort((a, b) => {
    const getY = (el: SVGGraphicsElement) => {
      const maskAttr = el.getAttribute('mask');
      if (maskAttr) {
        const id = maskAttr.match(/#([^)]+)/)?.[1];
        const maskEl = id ? document.getElementById(id) : null;
        const y = maskEl?.getAttribute('y');
        if (y) return parseFloat(y);
      }
      try { return el.getBBox().y; } catch (e) { return 0; }
    };
    return getY(b) - getY(a);
  });

  const totalElements = sortedElements.length;
  const lightingLevel = Math.floor((stats.value.percentComplete / 100) * totalElements);

  sortedElements.forEach((el, index) => {
    if (index < lightingLevel) {
      gsap.to(el, {
        opacity: 1,
        scale: 1,
        filter: `brightness(1.5) drop-shadow(0 0 10px ${tierColors[currentTier.value]})`,
        duration: 0.8,
        ease: 'power2.out'
      });
    } else {
      gsap.to(el, {
        opacity: 0.3,
        scale: 0.97,
        filter: 'brightness(0.7)',
        duration: 0.8,
        ease: 'power2.in'
      });
    }
  });
}

// Main slot machine animation
function triggerSlotMachineAnimation(amount: number): void {
  // Determine tier
  let tier: 'petit' | 'moyen' | 'grand' | 'exceptionnel' = 'petit';
  if (amount >= 50000) tier = 'exceptionnel';
  else if (amount >= 20000) tier = 'grand';
  else if (amount >= 5000) tier = 'moyen';

  playDonationSound(tier);

  // Spin the reels!
  spinReels(tier);

  // Update display with counting animation
  animateAmountCounter(amount);

  // Shake the menorah
  shakeMenuorah(tier);

  // Update lighting
  setTimeout(() => updateLighting(), 500);

  // Check for tier transition
  const newTier = currentTier.value;
  if (newTier > previousTier.value) {
    setTimeout(() => triggerTierTransition(previousTier.value, newTier), 2000);
    previousTier.value = newTier;
  }

  // Big win display for large donations
  if (tier === 'grand' || tier === 'exceptionnel') {
    showBigWinAnimation(amount, tier);
  }
}

// Spin the reels
function spinReels(tier: string): void {
  const spinsPerReel = [8, 12, 16]; // More spins for suspense
  const finalSymbols = getWinningSymbols(tier);

  reels.value.forEach((reel, index) => {
    reel.spinning = true;

    // Spin animation
    let spins = 0;
    const spinInterval = setInterval(() => {
      reel.current = (reel.current + 1) % reel.symbols.length;
      spins++;

      if (spins >= spinsPerReel[index]) {
        clearInterval(spinInterval);
        reel.current = finalSymbols[index];
        reel.spinning = false;

        // Check for jackpot on last reel
        if (index === 2) {
          checkJackpot(finalSymbols);
        }
      }
    }, 80 + index * 20); // Slower for later reels
  });
}

// Get winning symbols based on tier
function getWinningSymbols(tier: string): number[] {
  switch (tier) {
    case 'exceptionnel':
      return [0, 0, 0]; // Triple ✡ - JACKPOT!
    case 'grand':
      return [1, 1, Math.floor(Math.random() * 5)]; // Double 🕎
    case 'moyen':
      return [2, Math.floor(Math.random() * 5), 2]; // 💰 sides
    default:
      return [
        Math.floor(Math.random() * 5),
        Math.floor(Math.random() * 5),
        Math.floor(Math.random() * 5)
      ];
  }
}

// Check for jackpot
function checkJackpot(symbols: number[]): void {
  if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
    triggerJackpot();
  }
}

// Trigger jackpot animation
function triggerJackpot(): void {
  jackpotActive.value = true;

  // Explosion of coins
  generateCoinExplosion(50);

  // Fireworks
  for (let i = 0; i < 8; i++) {
    setTimeout(() => generateFirework(), i * 300);
  }

  // Screen shake
  gsap.to('.menorah-jackpot', {
    x: 'random(-20, 20)',
    y: 'random(-10, 10)',
    duration: 0.1,
    repeat: 20,
    yoyo: true,
    onComplete: () => {
      gsap.set('.menorah-jackpot', { x: 0, y: 0 });
    }
  });

  setTimeout(() => {
    jackpotActive.value = false;
  }, 5000);
}

// Animate amount counter
function animateAmountCounter(addedAmount: number): void {
  const startValue = displayAmount.value;
  const endValue = startValue + addedAmount;

  gsap.to(displayAmount, {
    value: endValue,
    duration: 1.5,
    ease: 'power2.out',
    onUpdate: () => {
      displayAmount.value = Math.floor(displayAmount.value);
    }
  });
}

// Shake menorah based on tier
function shakeMenuorah(tier: string): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const intensity = tier === 'exceptionnel' ? 20 : tier === 'grand' ? 12 : tier === 'moyen' ? 6 : 3;

  gsap.to(svg, {
    x: `random(-${intensity}, ${intensity})`,
    duration: 0.08,
    repeat: intensity,
    yoyo: true,
    onComplete: () => {
      gsap.to(svg, { x: 0, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
    }
  });

  // Flash
  gsap.fromTo(svg,
    { filter: `brightness(${1 + intensity / 10})` },
    { filter: 'brightness(1)', duration: 0.8, ease: 'power2.out' }
  );
}

// Big win animation
function showBigWinAnimation(amount: number, tier: string): void {
  bigWinAmount.value = amount;
  showBigWin.value = true;

  // Animate big win text
  gsap.fromTo('.big-win-text',
    { scale: 0, rotation: -30 },
    {
      scale: 1,
      rotation: 0,
      duration: 0.5,
      ease: 'back.out(2)'
    }
  );

  setTimeout(() => {
    gsap.to('.big-win-text', {
      scale: 0,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        showBigWin.value = false;
      }
    });
  }, 3000);
}

// Tier transition
function triggerTierTransition(fromTier: number, toTier: number): void {
  playTierTransition(fromTier, toTier);

  // Flash border with new tier color
  gsap.fromTo('.tier-border',
    { boxShadow: `0 0 100px ${tierColors[toTier]}` },
    {
      boxShadow: `0 0 30px ${tierColors[toTier]}`,
      duration: 2,
      ease: 'power2.out'
    }
  );

  // Fireworks for tier up
  for (let i = 0; i < 5; i++) {
    setTimeout(() => generateFirework(), i * 200);
  }

  // If reached max tier
  if (toTier === 5) {
    playAccomplissement();
    triggerUltimateCelebration();
  }
}

// Ultimate celebration for 100%
function triggerUltimateCelebration(): void {
  // Massive coin explosion
  generateCoinExplosion(100);

  // Continuous fireworks
  for (let i = 0; i < 20; i++) {
    setTimeout(() => generateFirework(), i * 150);
  }

  // Rainbow border
  gsap.to('.tier-border', {
    boxShadow: [
      '0 0 60px #FF0000',
      '0 0 60px #FF7F00',
      '0 0 60px #FFFF00',
      '0 0 60px #00FF00',
      '0 0 60px #0000FF',
      '0 0 60px #8B00FF',
    ],
    duration: 0.5,
    repeat: 10,
    ease: 'none'
  });
}

// Generate coin explosion
function generateCoinExplosion(count: number): void {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const coin = {
        id: nextCoinId++,
        x: 50 + (Math.random() - 0.5) * 40,
        y: 50,
        rotation: Math.random() * 360
      };
      coinExplosion.value.push(coin);

      setTimeout(() => {
        const index = coinExplosion.value.findIndex(c => c.id === coin.id);
        if (index !== -1) coinExplosion.value.splice(index, 1);
      }, 3000);
    }, i * 30);
  }
}

// Generate firework
function generateFirework(): void {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const firework = {
    id: nextFireworkId++,
    x: 10 + Math.random() * 80,
    y: 20 + Math.random() * 40,
    color: colors[Math.floor(Math.random() * colors.length)]
  };
  fireworks.value.push(firework);

  setTimeout(() => {
    const index = fireworks.value.findIndex(f => f.id === firework.id);
    if (index !== -1) fireworks.value.splice(index, 1);
  }, 1500);
}

// Watch stats changes
watch(() => stats.value.percentComplete, () => {
  updateLighting();
});

onUnmounted(() => {
  gsap.killTweensOf('*');
});
</script>

<template>
  <div class="menorah-jackpot" :class="{ 'jackpot-active': jackpotActive }">
    <!-- Background -->
    <div class="background">
      <div class="bg-gradient"></div>
      <div class="bg-stars"></div>
      <div class="menorah-glow"></div>
      <div class="tier-border" :style="{ borderColor: tierColors[currentTier] }"></div>
    </div>

    <!-- Slot machine reels -->
    <div class="slot-machine">
      <div class="slot-frame">
        <div
          v-for="(reel, index) in reels"
          :key="index"
          class="reel"
          :class="{ spinning: reel.spinning }"
        >
          <div class="reel-symbol">{{ reel.symbols[reel.current] }}</div>
        </div>
      </div>
      <div class="slot-label">DONATION SLOTS</div>
    </div>

    <!-- Amount display -->
    <div class="amount-display">
      <div class="display-label">TOTAL COLLECTÉ</div>
      <div class="display-value">{{ formatAmount(displayAmount) }} ₪</div>
      <div class="tier-badge" :style="{ backgroundColor: tierColors[currentTier] }">
        {{ tierNames[currentTier] }}
      </div>
    </div>

    <!-- Progress bar -->
    <div class="progress-container">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${stats.percentComplete}%`, backgroundColor: tierColors[currentTier] }"
        ></div>
      </div>
      <div class="progress-text">{{ Math.round(stats.percentComplete) }}%</div>
    </div>

    <!-- Big win overlay -->
    <div v-if="showBigWin" class="big-win-overlay">
      <div class="big-win-text">
        <div class="big-win-label">GROS DON!</div>
        <div class="big-win-amount">{{ formatAmount(bigWinAmount) }} ₪</div>
      </div>
    </div>

    <!-- Coin explosion -->
    <div class="coins-container">
      <div
        v-for="coin in coinExplosion"
        :key="coin.id"
        class="coin"
        :style="{
          left: `${coin.x}%`,
          top: `${coin.y}%`,
          '--rotation': `${coin.rotation}deg`
        }"
      >💰</div>
    </div>

    <!-- Fireworks -->
    <div class="fireworks-container">
      <div
        v-for="fw in fireworks"
        :key="fw.id"
        class="firework"
        :style="{
          left: `${fw.x}%`,
          top: `${fw.y}%`,
          '--color': fw.color
        }"
      ></div>
    </div>

    <!-- Menorah SVG -->
    <div class="menorah-wrapper">
      <div
        ref="svgContainer"
        class="menorah-container"
        :class="{ loaded: isLoaded }"
        v-html="svgContent"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.menorah-jackpot {
  min-height: 100vh;
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 20% 100%, rgba(236, 72, 153, 0.08) 0%, transparent 50%),
    linear-gradient(180deg, #0a0a1a 0%, #111827 50%, #0f172a 100%);
}

.bg-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(2px 2px at 20px 30px, rgba(255, 255, 255, 0.3), transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(255, 255, 255, 0.2), transparent),
    radial-gradient(1px 1px at 90px 40px, rgba(255, 255, 255, 0.4), transparent),
    radial-gradient(2px 2px at 130px 80px, rgba(255, 255, 255, 0.2), transparent),
    radial-gradient(1px 1px at 160px 30px, rgba(255, 255, 255, 0.3), transparent);
  background-repeat: repeat;
  background-size: 200px 100px;
  animation: twinkle 4s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.menorah-glow {
  position: absolute;
  top: 60%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%);
  filter: blur(60px);
}

.tier-border {
  position: absolute;
  inset: 0;
  border: 4px solid transparent;
  box-shadow: 0 0 30px currentColor;
  transition: all 0.5s ease;
  pointer-events: none;
}

.jackpot-active .tier-border {
  animation: jackpotBorder 0.2s ease-in-out infinite;
}

@keyframes jackpotBorder {
  0%, 100% { box-shadow: 0 0 30px #FFD700, inset 0 0 30px rgba(255, 215, 0, 0.2); }
  50% { box-shadow: 0 0 80px #FFD700, inset 0 0 60px rgba(255, 215, 0, 0.4); }
}

/* Slot machine */
.slot-machine {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
}

.slot-frame {
  display: flex;
  gap: 8px;
  padding: 15px 20px;
  background: linear-gradient(145deg, #1a1a2e, #16213e);
  border: 3px solid #FFD700;
  border-radius: 15px;
  box-shadow:
    0 0 20px rgba(255, 215, 0, 0.3),
    inset 0 0 20px rgba(0, 0, 0, 0.5);
}

.reel {
  width: 60px;
  height: 70px;
  background: linear-gradient(180deg, #0a0a1a, #1a1a2e);
  border: 2px solid #333;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.reel.spinning .reel-symbol {
  animation: spin 0.1s linear infinite;
}

@keyframes spin {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

.reel-symbol {
  font-size: 36px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.slot-label {
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  font-weight: bold;
  color: #FFD700;
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

/* Amount display */
.amount-display {
  position: fixed;
  top: 130px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 40;
}

.display-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 3px;
  margin-bottom: 5px;
}

.display-value {
  font-size: 48px;
  font-weight: bold;
  color: #FFD700;
  text-shadow:
    0 0 20px rgba(255, 215, 0, 0.5),
    0 0 40px rgba(255, 215, 0, 0.3);
  font-family: 'Courier New', monospace;
}

.tier-badge {
  display: inline-block;
  padding: 5px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  color: #000;
  margin-top: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

/* Progress bar */
.progress-container {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 600px;
  z-index: 40;
}

.progress-bar {
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.progress-fill {
  height: 100%;
  transition: width 1s ease, background-color 0.5s ease;
  box-shadow: 0 0 20px currentColor;
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 18px;
  font-weight: bold;
  color: white;
}

/* Big win overlay */
.big-win-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
}

.big-win-text {
  text-align: center;
}

.big-win-label {
  font-size: 72px;
  font-weight: bold;
  color: #FFD700;
  text-shadow:
    0 0 30px rgba(255, 215, 0, 0.8),
    0 0 60px rgba(255, 215, 0, 0.5);
  animation: pulse 0.5s ease-in-out infinite;
}

.big-win-amount {
  font-size: 48px;
  color: white;
  margin-top: 20px;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Coins */
.coins-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 80;
}

.coin {
  position: absolute;
  font-size: 30px;
  animation: coinFall 3s ease-out forwards;
  transform: rotate(var(--rotation, 0deg));
}

@keyframes coinFall {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg) scale(0.5);
    opacity: 0;
  }
}

/* Fireworks */
.fireworks-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 70;
}

.firework {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color, #FFD700);
  animation: fireworkExplode 1.5s ease-out forwards;
  box-shadow: 0 0 20px var(--color, #FFD700);
}

@keyframes fireworkExplode {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  50% {
    transform: scale(3);
    opacity: 1;
  }
  100% {
    transform: scale(5);
    opacity: 0;
  }
}

.firework::before,
.firework::after {
  content: '';
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color, #FFD700);
  box-shadow: 0 0 10px var(--color, #FFD700);
}

.firework::before {
  animation: fireworkParticle1 1.5s ease-out forwards;
}

.firework::after {
  animation: fireworkParticle2 1.5s ease-out forwards;
}

@keyframes fireworkParticle1 {
  0% { transform: translate(0, 0); opacity: 1; }
  100% { transform: translate(50px, -50px); opacity: 0; }
}

@keyframes fireworkParticle2 {
  0% { transform: translate(0, 0); opacity: 1; }
  100% { transform: translate(-50px, -30px); opacity: 0; }
}

/* Menorah */
.menorah-wrapper {
  position: relative;
  z-index: 10;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  margin-top: 100px;
}

.menorah-container {
  width: 100%;
  max-width: 80vw;
  height: auto;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.menorah-container.loaded {
  opacity: 1;
}

.menorah-container :deep(svg) {
  width: 100%;
  height: 55vh;
  max-height: 55vh;
  display: block;
  margin: 0 auto;
}

.menorah-container :deep(path) {
  fill: #EBD45C;
  transition: all 0.6s ease;
}

.menorah-container :deep(g[mask]) {
  transition: all 0.6s ease;
}

/* Responsive */
@media (max-width: 768px) {
  .display-value {
    font-size: 32px;
  }

  .slot-frame {
    padding: 10px 15px;
  }

  .reel {
    width: 45px;
    height: 55px;
  }

  .reel-symbol {
    font-size: 28px;
  }

  .big-win-label {
    font-size: 48px;
  }

  .menorah-container :deep(svg) {
    height: 45vh;
    max-height: 45vh;
  }
}
</style>
