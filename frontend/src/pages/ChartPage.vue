<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../composables/useDonations';
import { useSocket } from '../composables/useSocket';

const { donations, stats, config, formatAmount, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on, isConnected } = useSocket();

const chartRef = ref<SVGSVGElement | null>(null);
const pathRef = ref<SVGPathElement | null>(null);
const isAnimated = ref(false);

// Dimensions du graphique
const chartWidth = 800;
const chartHeight = 400;
const padding = { top: 40, right: 40, bottom: 60, left: 80 };
const innerWidth = chartWidth - padding.left - padding.right;
const innerHeight = chartHeight - padding.top - padding.bottom;

// Calculer les données cumulatives pour le graphique
const chartData = computed(() => {
  if (donations.value.length === 0) return [];

  // Trier par date
  const sorted = [...donations.value].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Calculer le cumul
  let cumulative = 0;
  return sorted.map((d, index) => {
    cumulative += d.amount;
    return {
      index,
      date: new Date(d.createdAt),
      amount: d.amount,
      cumulative,
      donor: `${d.firstName} ${d.lastName}`
    };
  });
});

// Générer le path SVG
const pathD = computed(() => {
  if (chartData.value.length === 0) return '';

  const maxAmount = Math.max(config.value.goalAmount, stats.value.totalAmount);
  const xScale = (i: number) => padding.left + (i / Math.max(1, chartData.value.length - 1)) * innerWidth;
  const yScale = (val: number) => padding.top + innerHeight - (val / maxAmount) * innerHeight;

  let d = `M ${xScale(0)} ${yScale(chartData.value[0].cumulative)}`;

  chartData.value.forEach((point, i) => {
    if (i > 0) {
      d += ` L ${xScale(i)} ${yScale(point.cumulative)}`;
    }
  });

  return d;
});

// Points de données pour affichage
const dataPoints = computed(() => {
  if (chartData.value.length === 0) return [];

  const maxAmount = Math.max(config.value.goalAmount, stats.value.totalAmount);
  const xScale = (i: number) => padding.left + (i / Math.max(1, chartData.value.length - 1)) * innerWidth;
  const yScale = (val: number) => padding.top + innerHeight - (val / maxAmount) * innerHeight;

  return chartData.value.map((point, i) => ({
    x: xScale(i),
    y: yScale(point.cumulative),
    ...point
  }));
});

// Ligne d'objectif
const goalLineY = computed(() => {
  const maxAmount = Math.max(config.value.goalAmount, stats.value.totalAmount);
  return padding.top + innerHeight - (config.value.goalAmount / maxAmount) * innerHeight;
});

// Y-axis ticks
const yTicks = computed(() => {
  const maxAmount = Math.max(config.value.goalAmount, stats.value.totalAmount);
  const tickCount = 5;
  const ticks = [];

  for (let i = 0; i <= tickCount; i++) {
    const value = (maxAmount / tickCount) * i;
    const y = padding.top + innerHeight - (value / maxAmount) * innerHeight;
    ticks.push({ value, y });
  }

  return ticks;
});

onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Animation d'entrée
  setTimeout(() => {
    animateChart();
  }, 300);

  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    animateNewPoint();
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

function animateChart(): void {
  isAnimated.value = true;

  // Animation header
  gsap.from('.chart-header', {
    y: -30,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.out'
  });

  // Animation du path
  if (pathRef.value) {
    const length = pathRef.value.getTotalLength();
    gsap.fromTo(pathRef.value,
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 2, ease: 'power2.out' }
    );
  }

  // Animation des points
  gsap.from('.data-point', {
    scale: 0,
    opacity: 0,
    duration: 0.4,
    stagger: 0.08,
    ease: 'back.out(2)',
    delay: 0.5
  });

  // Animation de la ligne d'objectif
  gsap.from('.goal-line', {
    scaleX: 0,
    transformOrigin: 'left',
    duration: 1,
    ease: 'power2.out',
    delay: 1
  });

  // Animation des stats
  gsap.from('.stat-box', {
    y: 30,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power2.out',
    delay: 1.2
  });
}

function animateNewPoint(): void {
  const points = document.querySelectorAll('.data-point');
  const lastPoint = points[points.length - 1];

  if (lastPoint) {
    gsap.fromTo(lastPoint,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: 'elastic.out(1, 0.5)'
      }
    );

    // Flash effect
    gsap.to(lastPoint, {
      filter: 'drop-shadow(0 0 20px #D4AF37)',
      duration: 0.3,
      yoyo: true,
      repeat: 2
    });
  }
}

onUnmounted(() => {
  gsap.killTweensOf('*');
});
</script>

<template>
  <div class="chart-page">
    <!-- Background -->
    <div class="bg-effects">
      <div class="bg-gradient"></div>
    </div>

    <!-- Connection Status -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'En direct' : 'Reconnexion...' }}
    </div>

    <!-- Header -->
    <header class="chart-header">
      <h1 class="title">Progression de la Campagne</h1>
      <p class="subtitle">Évolution des dons en temps réel</p>
    </header>

    <!-- Chart Container -->
    <div class="chart-container">
      <svg
        ref="chartRef"
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        class="chart-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <!-- Grille -->
        <g class="grid">
          <line
            v-for="tick in yTicks"
            :key="tick.value"
            :x1="padding.left"
            :y1="tick.y"
            :x2="chartWidth - padding.right"
            :y2="tick.y"
            class="grid-line"
          />
        </g>

        <!-- Axe Y -->
        <g class="y-axis">
          <line
            :x1="padding.left"
            :y1="padding.top"
            :x2="padding.left"
            :y2="chartHeight - padding.bottom"
            class="axis-line"
          />
          <g v-for="tick in yTicks" :key="tick.value">
            <text
              :x="padding.left - 10"
              :y="tick.y + 4"
              class="tick-label"
              text-anchor="end"
            >
              {{ formatAmount(tick.value) }}
            </text>
          </g>
        </g>

        <!-- Axe X -->
        <g class="x-axis">
          <line
            :x1="padding.left"
            :y1="chartHeight - padding.bottom"
            :x2="chartWidth - padding.right"
            :y2="chartHeight - padding.bottom"
            class="axis-line"
          />
        </g>

        <!-- Ligne d'objectif -->
        <g class="goal-group">
          <line
            :x1="padding.left"
            :y1="goalLineY"
            :x2="chartWidth - padding.right"
            :y2="goalLineY"
            class="goal-line"
          />
          <text
            :x="chartWidth - padding.right + 10"
            :y="goalLineY + 4"
            class="goal-label"
          >
            Objectif
          </text>
        </g>

        <!-- Zone sous la courbe -->
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
          </linearGradient>
        </defs>

        <path
          v-if="chartData.length > 0"
          :d="pathD + ` L ${padding.left + innerWidth} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`"
          class="area-fill"
          fill="url(#areaGradient)"
        />

        <!-- Courbe principale -->
        <path
          v-if="chartData.length > 0"
          ref="pathRef"
          :d="pathD"
          class="chart-line"
        />

        <!-- Points de données -->
        <g class="data-points">
          <g
            v-for="(point, index) in dataPoints"
            :key="index"
            class="data-point"
            :transform="`translate(${point.x}, ${point.y})`"
          >
            <circle r="8" class="point-outer"/>
            <circle r="4" class="point-inner"/>

            <!-- Tooltip on hover -->
            <g class="tooltip" :transform="`translate(0, -25)`">
              <rect x="-50" y="-20" width="100" height="24" rx="4" class="tooltip-bg"/>
              <text y="-4" text-anchor="middle" class="tooltip-text">
                {{ formatAmount(point.cumulative) }}
              </text>
            </g>
          </g>
        </g>
      </svg>
    </div>

    <!-- Stats Footer -->
    <footer class="stats-footer">
      <div class="stat-box">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value gold">{{ formatAmount(stats.totalAmount) }}</span>
          <span class="stat-label">Total collecté</span>
        </div>
      </div>

      <div class="stat-box">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ formatAmount(config.goalAmount) }}</span>
          <span class="stat-label">Objectif</span>
        </div>
      </div>

      <div class="stat-box">
        <div class="stat-icon highlight">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value gold">{{ stats.percentComplete.toFixed(1) }}%</span>
          <span class="stat-label">Progression</span>
        </div>
      </div>

      <div class="stat-box">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.donationCount }}</span>
          <span class="stat-label">Donateurs</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.chart-page {
  min-height: 100vh;
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Background */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse 60% 60% at 100% 100%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
    linear-gradient(180deg, #0a0a1a 0%, #0f172a 100%);
}

/* Connection Status */
.connection-status {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(239, 68, 68, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  color: #fca5a5;
  z-index: 100;
}

.connection-status.connected {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Header */
.chart-header {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 40px 20px 20px;
}

.title {
  font-size: 42px;
  font-weight: 700;
  color: #D4AF37;
  margin: 0;
  text-shadow: 0 0 30px rgba(212, 175, 55, 0.4);
}

.subtitle {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.5);
  margin: 10px 0 0;
}

/* Chart Container */
.chart-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 40px;
  position: relative;
  z-index: 10;
}

.chart-svg {
  width: 100%;
  max-width: 1000px;
  height: auto;
}

/* Grid */
.grid-line {
  stroke: rgba(255, 255, 255, 0.05);
  stroke-width: 1;
}

/* Axes */
.axis-line {
  stroke: rgba(255, 255, 255, 0.2);
  stroke-width: 2;
}

.tick-label {
  fill: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
}

/* Goal Line */
.goal-line {
  stroke: #22c55e;
  stroke-width: 2;
  stroke-dasharray: 8 4;
  opacity: 0.8;
}

.goal-label {
  fill: #22c55e;
  font-size: 12px;
  font-weight: 600;
}

/* Chart Line */
.chart-line {
  fill: none;
  stroke: #D4AF37;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.5));
}

.area-fill {
  opacity: 0.6;
}

/* Data Points */
.data-point {
  cursor: pointer;
}

.point-outer {
  fill: rgba(212, 175, 55, 0.3);
  transition: all 0.3s ease;
}

.point-inner {
  fill: #D4AF37;
  filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.8));
}

.data-point:hover .point-outer {
  fill: rgba(212, 175, 55, 0.5);
  r: 12;
}

/* Tooltip */
.tooltip {
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.data-point:hover .tooltip {
  opacity: 1;
}

.tooltip-bg {
  fill: rgba(0, 0, 0, 0.8);
  stroke: rgba(212, 175, 55, 0.5);
  stroke-width: 1;
}

.tooltip-text {
  fill: #D4AF37;
  font-size: 12px;
  font-weight: 600;
}

/* Stats Footer */
.stats-footer {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  padding: 30px 40px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.stat-box:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(212, 175, 55, 0.3);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-icon.highlight svg {
  color: #D4AF37;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.stat-value.gold {
  color: #D4AF37;
  text-shadow: 0 0 15px rgba(212, 175, 55, 0.4);
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-footer {
    flex-wrap: wrap;
    gap: 16px;
  }

  .stat-box {
    flex: 1 1 calc(50% - 16px);
    min-width: 200px;
  }
}

@media (max-width: 768px) {
  .chart-header {
    padding: 30px 20px 10px;
  }

  .title {
    font-size: 28px;
  }

  .chart-container {
    padding: 10px 20px;
  }

  .stats-footer {
    padding: 20px;
  }

  .stat-box {
    flex: 1 1 100%;
    padding: 12px 16px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
  }

  .stat-value {
    font-size: 20px;
  }
}
</style>
