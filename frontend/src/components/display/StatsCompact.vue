<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useDonations, DEFAULT_DISPLAY_TEXTS } from '../../composables/useDonations';
import { getActiveThemePalette } from '../../theme/displayThemes';
import { animateValue, easeOutCubic } from './animations';

const { stats, config, formatAmount } = useDonations();

const displayTexts = computed(() => ({
  ...DEFAULT_DISPLAY_TEXTS,
  ...(config.value.displaySettings.texts ?? {})
}));
const textDirection = computed(() => config.value.displaySettings.textDirection ?? 'auto');

// Dynamic styles from config
const statsStyles = computed(() => {
  const settings = getActiveThemePalette(config.value.displaySettings);
  return {
    '--stats-text-color': settings.statsTextColor,
    '--chart-primary-color': settings.chartPrimaryColor,
    '--chart-secondary-color': settings.chartSecondaryColor
  };
});

const displayValue = ref(0);
const displayPercent = ref(0);
let cancelCounter: (() => void) | null = null;

// Comptage anime du total. Tween centralise dans animations.ts (easeOutCubic,
// 1000 ms) — meme courbe qu'avant, mais respecte desormais prefers-reduced-motion.
function animateCounter(target: number): void {
  cancelCounter?.();
  cancelCounter = animateValue({
    from: displayValue.value,
    to: target,
    duration: 1000,
    easing: easeOutCubic,
    onUpdate: (value) => { displayValue.value = value; }
  });
}

watch(() => stats.value.totalAmount, animateCounter, { immediate: true });
watch(() => stats.value.percentComplete, (v) => { displayPercent.value = v; }, { immediate: true });

// La courbe est dessinee en pixels CSS : le viewBox suit la taille reelle du SVG,
// donc l'echelle vaut 1 sur les deux axes. Avec un viewBox fixe de 640x88 etire par
// preserveAspectRatio="none", scaleY/scaleX tombait a 0,38 dans une boite large et
// basse : la courbe etait ecrasee verticalement et le point d'arrivee, un cercle,
// se rendait en ovale. En 1:1 les longueurs du style (stroke-width, dasharray,
// rayons) valent aussi exactement ce qu'elles annoncent.
//
// Ce bloc est declare AVANT onMounted / onUnmounted, qui l'utilisent. L'ordre
// inverse fonctionnait — les hooks ne s'executent qu'apres la fin de setup —
// mais tout appel remonte dans le corps synchrone aurait leve un ReferenceError
// sur `chartResizeObserver` (temporal dead zone du `let`).
const chartEl = ref<SVGSVGElement | null>(null);
const chartWidth = ref(640);
const chartHeight = ref(88);
const isResizing = ref(false);
let chartResizeObserver: ResizeObserver | null = null;
let resizeSettleFrame: number | null = null;

function measureChart(): void {
  const el = chartEl.value;
  if (!el) return;
  const { width, height } = el.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  if (width === chartWidth.value && height === chartHeight.value) return;

  // Le `d` de la courbe est derive de la boite mesuree, et il est en transition
  // sur 700 ms. Sans cette suspension, un redimensionnement fait glisser la
  // courbe vers sa nouvelle geometrie pendant que les paliers en pointilles,
  // eux, sautent tout de suite : mesure 1440x900 -> 700x700, jusqu'a 9,2 px
  // d'ecart vertical entre le depart de la courbe et sa ligne de zero, et
  // 118 px d'ecart horizontal sur le point d'arrivee, pendant ~490 ms.
  // La classe et le nouveau `d` sont poses dans le meme patch DOM ; deux frames
  // plus tard le trace est peint a sa place et la transition peut reprendre.
  isResizing.value = true;
  chartWidth.value = width;
  chartHeight.value = height;
  if (resizeSettleFrame !== null) cancelAnimationFrame(resizeSettleFrame);
  resizeSettleFrame = requestAnimationFrame(() => {
    resizeSettleFrame = requestAnimationFrame(() => {
      resizeSettleFrame = null;
      isResizing.value = false;
    });
  });
}

onMounted(() => {
  displayValue.value = stats.value.totalAmount;
  displayPercent.value = stats.value.percentComplete;
  measureChart();
  if (chartEl.value) {
    chartResizeObserver = new ResizeObserver(measureChart);
    chartResizeObserver.observe(chartEl.value);
  }
  // Ceinture et bretelles : le rendu depend maintenant d'une mesure JS. Si le
  // ResizeObserver ne se declenche pas, le viewBox reste sur l'ancienne taille
  // et tout le graphique est redessine en letterbox (preserveAspectRatio vaut
  // xMidYMid meet par defaut). Ce rappel ne coute rien et fait tomber le mode
  // de degradation sur « rien ne bouge » plutot que « tout retrecit ».
  window.addEventListener('resize', measureChart);
});

onUnmounted(() => {
  cancelCounter?.();
  if (resizeSettleFrame !== null) cancelAnimationFrame(resizeSettleFrame);
  resizeSettleFrame = null;
  chartResizeObserver?.disconnect();
  chartResizeObserver = null;
  window.removeEventListener('resize', measureChart);
});

function formatNumber(cents: number): string {
  return (cents / 100).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const normalizedProgress = computed(() => Math.max(0, Math.min(displayPercent.value, 100)) / 100);

const CURVE_INSET = 14; // marge laterale, en pixels
const CURVE_HEADROOM = 8; // marge haute et basse, pour le point d'arrivee et son halo

const chartViewBox = computed(() => `0 0 ${chartWidth.value} ${chartHeight.value}`);

const curveGeometry = computed(() => {
  const left = CURVE_INSET;
  const right = Math.max(left + 1, chartWidth.value - CURVE_INSET);
  const topY = CURVE_HEADROOM;
  const baseY = Math.max(topY + 1, chartHeight.value - CURVE_HEADROOM);
  return {
    left,
    right,
    topY, // niveau atteint a 100%
    baseY, // ligne de zero
    midY: (topY + baseY) / 2, // palier intermediaire
    areaY: chartHeight.value - 2, // base de l'aplat, juste sous la ligne de zero
    span: right - left,
    rise: baseY - topY
  };
});

const curveEnd = computed(() => {
  const { left, baseY, span, rise } = curveGeometry.value;
  const progress = normalizedProgress.value;
  return {
    x: left + span * progress,
    y: baseY - rise * progress
  };
});
// A l'ecran ce trace se lit comme un trait droit, a tout avancement, et le
// passage du viewBox en 1:1 n'y a rien change. Mesure du 2026-07-27, boite
// 1229 x 64,8 px (rapport 18,97:1) ; fleche = ecart maximal a la corde :
//     10 %   corde  120 px   fleche 2,88 px   2,40 % de la corde
//     23,7 % corde  285 px   fleche 2,23 px   0,78 %   <- avancement reel
//     60 %   corde  721 px   fleche 1,76 px   0,24 %
//     100 %  corde 1202 px   fleche 3,10 px   0,26 %
// La fleche ne depasse jamais ~3 px sur toute la plage. C'est la boite qui est
// plate, pas les coefficients ci-dessous. Ne PAS ouvrir leur amplitude pour
// compenser : la donnee sous-jacente est une valeur unique, pas une serie
// temporelle. Une courbe promet deja un historique qui n'existe pas ; la bomber
// rendrait ce mensonge plus lisible, pas moins. La vraie reponse est le
// remplacement par une barre de progression remplie, prevu en tranche ulterieure.
const curvePath = computed(() => {
  const { left, baseY, rise } = curveGeometry.value;
  const end = curveEnd.value;
  const delta = end.x - left;
  const startControlY = baseY - rise * 0.08; // depart presque plat
  const endControlY = end.y + rise * 0.19; // redressement avant le point : ~2 a 3 px, voir ci-dessus
  return `M ${left} ${baseY} C ${left + delta * 0.28} ${startControlY}, ${left + delta * 0.66} ${endControlY}, ${end.x} ${end.y}`;
});
const curveAreaPath = computed(() => {
  const { left, areaY } = curveGeometry.value;
  return `${curvePath.value} L ${curveEnd.value.x} ${areaY} L ${left} ${areaY} Z`;
});
const baseGuidePath = computed(() => {
  const { left, right, baseY } = curveGeometry.value;
  return `M ${left} ${baseY} H ${right}`;
});
const midGuidePath = computed(() => {
  const { left, right, midY } = curveGeometry.value;
  return `M ${left} ${midY} H ${right}`;
});
const curveAriaLabel = computed(() => (
  `${displayPercent.value.toFixed(1)}% — ${displayTexts.value.goalLabel} ${formatAmount(config.value.goalAmount)}`
));
</script>

<template>
  <div
    class="stats-compact"
    :class="{ 'is-measuring': isResizing }"
    :style="statsStyles"
    :dir="textDirection"
  >
    <!-- Main amount -->
    <div class="main-row">
      <div class="amount-block">
        <span class="currency">₪</span>
        <span class="amount">{{ formatNumber(displayValue) }}</span>
      </div>
      <div class="percent-block">
        <span class="percent">{{ displayPercent.toFixed(1) }}%</span>
      </div>
    </div>

    <!-- Goal curve -->
    <div class="goal-curve">
      <svg
        ref="chartEl"
        class="curve-chart"
        :viewBox="chartViewBox"
        role="img"
        :aria-label="curveAriaLabel"
      >
        <defs>
          <linearGradient id="goalCurveLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="var(--chart-secondary-color)" />
            <stop offset="1" stop-color="var(--chart-primary-color)" />
          </linearGradient>
          <!-- Aplat sous la courbe. Reste en objectBoundingBox — un ancrage sur
               la BOITE du graphique a ete essaye, MESURE, puis abandonne.
               Mesure au pixel le 2026-07-27, theme Ivoire clair (#B08328),
               1440x900, avancement reel 23,7 %, temoin exact = meme capture avec
               .curve-area masque, donc sans confondant : l'ancrage sur la boite
               PALIT l'aplat, de 1,46:1 a 1,18:1 au maximum et de 1,27:1 a 1,12:1
               juste sous le trait. C'est structurel et non reglable : ancre sur
               la boite, le stop le plus dense n'est atteint QUE lorsque la courbe
               atteint le haut, c'est-a-dire a 100 % ; retrouver la densite
               actuelle a 23,7 % demanderait un stop a 1,43, qui n'existe pas.
               Ce qu'on renonce a corriger, en connaissance de cause : en
               objectBoundingBox le degrade s'etire avec la bbox du trace, donc
               l'aplat palit a mesure que la collecte monte (alpha 0,21 a 23,7 %,
               0,13 a 80 % — calcule, non mesure). On prefere l'etat le meilleur
               la ou l'application se trouve reellement.
               Aucune des deux options ne rend l'aplat franchement lisible : la
               vraie reponse est le remplacement par une barre remplie. -->
          <linearGradient
            id="goalCurveArea"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" stop-color="var(--chart-primary-color)" stop-opacity="0.55" />
            <stop offset="1" stop-color="var(--chart-primary-color)" stop-opacity="0.08" />
          </linearGradient>
        </defs>
        <path class="curve-guide" :d="baseGuidePath" />
        <path class="curve-guide curve-guide-mid" :d="midGuidePath" />
        <path class="curve-area" :d="curveAreaPath" />
        <path class="curve-line" :d="curvePath" />
        <circle class="curve-point-glow" :cx="curveEnd.x" :cy="curveEnd.y" r="8" />
        <circle class="curve-point" :cx="curveEnd.x" :cy="curveEnd.y" r="4" />
        <!-- Le marqueur s'arrete a la ligne de zero, pas a la base de l'aplat :
             areaY vaut chartHeight - 2 et .curve-labels remonte de 5 px, ce qui
             faisait mordre le marqueur de 3 px sur l'etiquette de l'objectif.
             topY -> baseY, c'est aussi exactement la montee que le marqueur
             represente. -->
        <line
          class="goal-marker"
          :x1="curveGeometry.right"
          :y1="curveGeometry.topY"
          :x2="curveGeometry.right"
          :y2="curveGeometry.baseY"
        />
      </svg>
      <div class="curve-labels">
        <span>0 ₪</span>
        <span :dir="textDirection">{{ displayTexts.goalLabel }} {{ formatAmount(config.goalAmount) }}</span>
      </div>
    </div>

    <!-- Info row -->
    <div class="info-row">
      <span class="info-item" :dir="textDirection">
        {{ stats.donationCount }} {{ stats.donationCount === 1 ? displayTexts.donationSingular : displayTexts.donationPlural }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.stats-compact {
  position: relative;
  overflow: hidden;
  background: var(--theme-surface, rgba(10, 10, 26, 0.72));
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #D4AF37) 25%, transparent);
  border-radius: var(--theme-radius, 14px);
  padding: 14px 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 16px 40px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
}

.stats-compact::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(110deg, color-mix(in srgb, var(--chart-primary-color) 8%, transparent), transparent 42%);
}

.main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.amount-block {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.currency {
  font-size: 18px;
  font-weight: 600;
  color: color-mix(in srgb, var(--chart-primary-color, #D4AF37) 60%, transparent);
}

.amount {
  font-family: var(--theme-font-display, inherit);
  font-size: 34px;
  font-weight: 800;
  color: var(--chart-primary-color, #D4AF37);
  text-shadow: 0 0 18px color-mix(in srgb, var(--chart-primary-color, #D4AF37) 25%, transparent);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.percent-block {
  text-align: right;
}

.percent {
  font-family: var(--theme-font-display, inherit);
  font-size: 20px;
  font-weight: 700;
  color: var(--chart-primary-color, #D4AF37);
}

.goal-curve {
  position: relative;
  margin: -2px 0 7px;
}

.curve-chart {
  display: block;
  width: 100%;
  height: clamp(62px, 7.2vh, 86px);
  overflow: visible;
}

.curve-guide {
  fill: none;
  stroke: color-mix(in srgb, var(--stats-text-color) 13%, transparent);
  stroke-width: 1;
  stroke-dasharray: 4 8;
}

.curve-guide-mid {
  opacity: 0.55;
}

.curve-area {
  fill: url(#goalCurveArea);
  transition: d 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.curve-line {
  fill: none;
  stroke: url(#goalCurveLine);
  stroke-width: 4;
  stroke-linecap: round;
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--chart-primary-color) 60%, transparent));
  transition: d 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.curve-point-glow {
  fill: color-mix(in srgb, var(--chart-primary-color) 20%, transparent);
  transition: cx 700ms cubic-bezier(0.16, 1, 0.3, 1), cy 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.curve-point {
  fill: var(--chart-primary-color);
  stroke: var(--stats-text-color);
  stroke-width: 1.5;
  transition: cx 700ms cubic-bezier(0.16, 1, 0.3, 1), cy 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.goal-marker {
  stroke: color-mix(in srgb, var(--chart-primary-color) 48%, transparent);
  stroke-width: 2;
  stroke-dasharray: 3 5;
}

/* Pendant une remesure de la boite (voir measureChart) : la courbe doit sauter
   avec les paliers en pointilles, qui n'ont aucune transition. */
.stats-compact.is-measuring .curve-area,
.stats-compact.is-measuring .curve-line,
.stats-compact.is-measuring .curve-point-glow,
.stats-compact.is-measuring .curve-point {
  transition: none;
}

/* Le `d` de la courbe suit desormais une mesure JS : chaque redimensionnement
   est devenu un declencheur de mouvement qui n'existait pas avant. */
@media (prefers-reduced-motion: reduce) {
  .curve-area,
  .curve-line,
  .curve-point-glow,
  .curve-point {
    transition: none;
  }
}

.curve-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -5px;
  color: color-mix(in srgb, var(--stats-text-color) 58%, transparent);
  font-size: 11px;
  font-weight: 650;
}

.curve-labels span:last-child {
  color: color-mix(in srgb, var(--chart-primary-color) 82%, white 10%);
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  font-size: 12px;
  color: color-mix(in srgb, var(--stats-text-color, #FFFFFF) 50%, transparent);
}

.stats-compact[dir='rtl'] .info-row {
  justify-content: flex-end;
}

@media (max-height: 760px) {
  .stats-compact {
    padding-block: 10px;
  }

  .curve-chart {
    height: 54px;
  }
}
</style>
