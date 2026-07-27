<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  useDonations,
  DEFAULT_PLEDGE_TEXTS,
  DEFAULT_PLEDGE_REQUIRED_FIELDS,
  type PledgePageCopy,
  type PledgeRequiredFields
} from '../composables/useDonations';
import { useEventContext } from '../composables/useEventContext';
import { getPledgeThemeStyles } from '../theme/displayThemes';

const { config, fetchConfig, createDonation, formatAmount, isLoading, error } = useDonations();

// Variables du theme de la soiree — memes helpers que les ecrans de salle. La page
// tire fond/texte/accents de ces variables (voir <style>), avec les valeurs
// actuelles en repli : tant que la config n'est pas chargee, le rendu est
// byte-identique a avant, jamais un flash illisible. Le thème se gère donc au meme
// endroit que les displays : Personnalisation -> Theme et couleurs.
const themeStyles = computed(() => getPledgeThemeStyles(config.value.displaySettings));

// Contexte de soiree : /don => soiree active (herite) ; /e/:slug/don => soiree
// nommee. Un slug inconnu affiche un etat 404 propre, jamais un repli silencieux
// sur une autre soiree (un don irait alors sur le mauvais mur).
const route = useRoute();
const { resolve, notFound: pageNotFound, clear } = useEventContext();

type Locale = 'fr' | 'he' | 'en';
const locale = ref<Locale>('he');

const MESSAGES: Record<Locale, Record<string, string>> = {
  fr: {
    firstName: 'Prénom',
    firstNamePlaceholder: 'Votre prénom',
    lastName: 'Nom',
    lastNamePlaceholder: 'Votre nom',
    phone: 'Téléphone',
    phonePlaceholder: '05X XXX XXXX',
    email: 'Email',
    emailPlaceholder: 'exemple@email.com',
    amount: 'Montant du don',
    customAmount: 'Autre montant (₪)',
    submit: 'Valider mon don',
    submitting: 'Envoi en cours...',
    newDonation: 'Enregistrer un autre don',
    required: 'Veuillez remplir tous les champs obligatoires (*) et un montant.',
    anonymous: 'Anonyme',
    raised: 'déjà collectés',
    notFoundTitle: 'Soirée introuvable',
    notFoundMessage: 'Aucune soirée ne correspond à cette adresse.'
  },
  he: {
    firstName: 'שם פרטי',
    firstNamePlaceholder: 'השם הפרטי שלך',
    lastName: 'שם משפחה',
    lastNamePlaceholder: 'שם משפחה',
    phone: 'טלפון',
    phonePlaceholder: '05X XXX XXXX',
    email: 'אימייל',
    emailPlaceholder: 'exemple@email.com',
    amount: 'סכום התרומה',
    customAmount: 'סכום אחר (₪)',
    submit: 'אישור התרומה',
    submitting: 'שולח...',
    newDonation: 'רישום תרומה נוספת',
    required: 'נא למלא את כל שדות החובה (*) וסכום.',
    anonymous: 'אנונימי',
    raised: 'נאספו עד כה',
    notFoundTitle: 'הערב לא נמצא',
    notFoundMessage: 'אין ערב התואם לכתובת זו.'
  },
  en: {
    firstName: 'First name',
    firstNamePlaceholder: 'Your first name',
    lastName: 'Last name',
    lastNamePlaceholder: 'Your last name',
    phone: 'Phone',
    phonePlaceholder: '05X XXX XXXX',
    email: 'Email',
    emailPlaceholder: 'example@email.com',
    amount: 'Donation amount',
    customAmount: 'Other amount (₪)',
    submit: 'Confirm my donation',
    submitting: 'Sending...',
    newDonation: 'Record another donation',
    required: 'Please fill in all required fields (*) and an amount.',
    anonymous: 'Anonymous',
    raised: 'raised so far',
    notFoundTitle: 'Event not found',
    notFoundMessage: 'No event matches this address.'
  }
};

const t = (key: string): string => MESSAGES[locale.value][key] || key;
const isRtl = computed(() => locale.value === 'he');

const firstName = ref('');
const lastName = ref('');
const phone = ref('');
const email = ref('');
const amount = ref(0);
const customAmount = ref('');
const localError = ref('');
const showCelebration = ref(false);
const celebratedName = ref('');
const celebratedAmount = ref(0);
const displayedAmount = ref(0);

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
  drift: number;
}
const confetti = ref<ConfettiPiece[]>([]);

const organizationName = computed(() =>
  config.value.displaySettings?.texts?.organizationName || 'OHEL YEHOSHUA'
);

// Editorial copy comes from the admin config (per locale); empty fields hide the element
const pledgeCopy = computed<PledgePageCopy>(() =>
  config.value.displaySettings?.pledgeTexts?.[locale.value] ?? DEFAULT_PLEDGE_TEXTS[locale.value]
);

// Which fields are mandatory is decided by the admin config — nothing hard-imposed here.
const requiredFields = computed<PledgeRequiredFields>(() =>
  config.value.displaySettings?.pledgeRequiredFields ?? DEFAULT_PLEDGE_REQUIRED_FIELDS
);

const presets = computed(() => config.value.presetAmounts || []);

onMounted(async () => {
  // Resout le contexte AVANT de charger la config : la portee ambiante ainsi
  // posee dirige fetchConfig et createDonation vers la bonne soiree.
  await resolve(typeof route.params.slug === 'string' ? route.params.slug : null);
  if (!pageNotFound.value) {
    fetchConfig();
  }
});

onUnmounted(() => {
  // Ne pas laisser fuiter la portee de cette soiree sur la page suivante.
  clear();
});

function selectPreset(preset: number): void {
  amount.value = preset;
  customAmount.value = '';
  localError.value = '';
}

function updateCustomAmount(value: string): void {
  customAmount.value = value;
  const parsed = parseFloat(value);
  amount.value = !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
  localError.value = '';
}

function makeConfetti(): void {
  const colors = ['#FFD700', '#E4BE63', '#F8E7B3', '#C8922A', '#FFF3C4', '#B67846'];
  confetti.value = Array.from({ length: 110 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    duration: 2.6 + Math.random() * 2.4,
    size: 6 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotate: Math.random() * 720 - 360,
    drift: Math.random() * 120 - 60
  }));
}

function animateAmount(target: number): void {
  displayedAmount.value = 0;
  const start = performance.now();
  const duration = 1400;
  function step(now: number): void {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    displayedAmount.value = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function submit(): Promise<void> {
  localError.value = '';
  const req = requiredFields.value;
  if (
    (req.firstName && !firstName.value.trim()) ||
    (req.lastName && !lastName.value.trim()) ||
    (req.phone && !phone.value.trim()) ||
    (req.email && !email.value.trim()) ||
    amount.value <= 0
  ) {
    localError.value = t('required');
    return;
  }

  const result = await createDonation({
    // firstName is enforced by the backend as the minimal identity; if the admin
    // made it optional and it is left blank, fall back to a localized "Anonymous".
    firstName: firstName.value.trim() || t('anonymous'),
    lastName: lastName.value.trim() || undefined,
    phone: phone.value.trim() || undefined,
    email: email.value.trim() || undefined,
    amount: amount.value
  });

  if (result) {
    celebratedName.value = result.firstName;
    celebratedAmount.value = result.amount;
    makeConfetti();
    showCelebration.value = true;
    animateAmount(result.amount);
  }
}

function reset(): void {
  showCelebration.value = false;
  confetti.value = [];
  firstName.value = '';
  lastName.value = '';
  phone.value = '';
  email.value = '';
  amount.value = 0;
  customAmount.value = '';
  localError.value = '';
}
</script>

<template>
  <div class="pledge-page" :dir="isRtl ? 'rtl' : 'ltr'" :style="themeStyles">
    <div class="glow glow-top"></div>
    <div class="glow glow-bottom"></div>

    <!-- Language switcher -->
    <div class="lang-switcher">
      <button
        v-for="lang in (['fr', 'he', 'en'] as const)"
        :key="lang"
        :class="['lang-btn', { active: locale === lang }]"
        @click="locale = lang"
      >
        {{ lang === 'fr' ? 'FR' : lang === 'he' ? 'עב' : 'EN' }}
      </button>
    </div>

    <div v-if="pageNotFound" class="pledge-notfound">
      <div class="notfound-card">
        <h1>{{ t('notFoundTitle') }}</h1>
        <p>{{ t('notFoundMessage') }}</p>
      </div>
    </div>

    <div v-else-if="!showCelebration" class="content">
      <header class="header">
        <div class="flame-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2c0 4-5 5.5-5 10a5 5 0 0 0 10 0c0-1.5-.5-2.7-1.2-3.8C15.2 9.8 14 11 14 12.5c0 0-2-1.6-2-4.5 0-2.4 0-4.5 0-6z"/>
          </svg>
        </div>
        <p v-if="pledgeCopy.kicker" class="kicker">{{ pledgeCopy.kicker }}</p>
        <h1 class="org-name">{{ organizationName }}</h1>
        <h2 v-if="pledgeCopy.title" class="title">{{ pledgeCopy.title }}</h2>
        <p v-if="pledgeCopy.subtitle" class="subtitle">{{ pledgeCopy.subtitle }}</p>
      </header>

      <form class="card" @submit.prevent="submit">
        <div class="field-row">
          <div class="field">
            <label for="p-firstname">{{ t('firstName') }}{{ requiredFields.firstName ? ' *' : '' }}</label>
            <input id="p-firstname" v-model="firstName" type="text" :required="requiredFields.firstName" :placeholder="t('firstNamePlaceholder')" />
          </div>
          <div class="field">
            <label for="p-lastname">{{ t('lastName') }}{{ requiredFields.lastName ? ' *' : '' }}</label>
            <input id="p-lastname" v-model="lastName" type="text" :required="requiredFields.lastName" :placeholder="t('lastNamePlaceholder')" />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="p-phone">{{ t('phone') }}{{ requiredFields.phone ? ' *' : '' }}</label>
            <input id="p-phone" v-model="phone" type="tel" :required="requiredFields.phone" :placeholder="t('phonePlaceholder')" />
          </div>
          <div class="field">
            <label for="p-email">{{ t('email') }}{{ requiredFields.email ? ' *' : '' }}</label>
            <input id="p-email" v-model="email" type="email" :required="requiredFields.email" :placeholder="t('emailPlaceholder')" />
          </div>
        </div>

        <div class="field">
          <label>{{ t('amount') }}</label>
          <div class="preset-grid">
            <button
              v-for="preset in presets"
              :key="preset"
              type="button"
              :class="['preset', { selected: amount === preset && !customAmount }]"
              @click="selectPreset(preset)"
            >
              {{ formatAmount(preset) }}
            </button>
          </div>
          <div class="custom-wrapper">
            <span class="currency">₪</span>
            <input
              type="number"
              inputmode="decimal"
              min="1"
              step="0.01"
              :value="customAmount"
              @input="updateCustomAmount(($event.target as HTMLInputElement).value)"
              :placeholder="t('customAmount')"
            />
          </div>
        </div>

        <div v-if="localError || error" class="form-error">
          {{ localError || error }}
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="!isLoading">✦ {{ t('submit') }}</span>
          <span v-else>{{ t('submitting') }}</span>
        </button>

        <p v-if="amount > 0" class="amount-preview">
          {{ formatAmount(amount) }}
        </p>
      </form>
    </div>

    <!-- Celebration overlay -->
    <div v-else class="celebration">
      <div class="confetti-layer">
        <span
          v-for="piece in confetti"
          :key="piece.id"
          class="confetti"
          :style="{
            left: piece.left + '%',
            width: piece.size + 'px',
            height: piece.size * 0.4 + 'px',
            background: piece.color,
            animationDelay: piece.delay + 's',
            animationDuration: piece.duration + 's',
            '--rotate': piece.rotate + 'deg',
            '--drift': piece.drift + 'px'
          }"
        ></span>
      </div>

      <div class="celebration-card">
        <div class="big-flame">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2c0 4-5 5.5-5 10a5 5 0 0 0 10 0c0-1.5-.5-2.7-1.2-3.8C15.2 9.8 14 11 14 12.5c0 0-2-1.6-2-4.5 0-2.4 0-4.5 0-6z"/>
          </svg>
        </div>
        <h2 class="thank-title">{{ pledgeCopy.thankTitle }} {{ celebratedName }} !</h2>
        <p class="thank-amount">{{ formatAmount(displayedAmount) }}</p>
        <p v-if="pledgeCopy.thankMessage" class="thank-message">{{ pledgeCopy.thankMessage }}</p>
        <button class="submit-btn again-btn" @click="reset">{{ t('newDonation') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pledge-page {
  min-height: 100vh;
  min-height: 100dvh;
  /* Fond du theme de la soiree. Repli = le degrade actuel : sans config chargee,
     var(--bg-color) n'existe pas et la valeur de repli s'applique a l'identique. */
  background: var(--bg-color, radial-gradient(ellipse at top, #131731 0%, #070914 55%));
  color: var(--stats-text-color, #f7f3ea);
  font-family: var(--theme-font-body, 'Segoe UI', 'Heebo', Tahoma, sans-serif);
  position: relative;
  overflow-x: hidden;
  padding: 24px 16px 48px;
  box-sizing: border-box;
}

.glow {
  position: fixed;
  border-radius: 50%;
  filter: blur(110px);
  opacity: 0.35;
  pointer-events: none;
}

.glow-top {
  top: -120px;
  inset-inline-start: -80px;
  width: 340px;
  height: 340px;
  background: var(--chart-primary-color, #e4be63);
}

.glow-bottom {
  bottom: -140px;
  inset-inline-end: -100px;
  width: 380px;
  height: 380px;
  background: var(--chart-secondary-color, #4a3a8a);
}

.lang-switcher {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  max-width: 560px;
  margin: 0 auto 8px;
  position: relative;
  z-index: 2;
}

.lang-btn {
  /* Texte du thème (jamais fige) : sur Ivoire clair, --stats-text-color est
     sombre et reste lisible ; un blanc fige y disparaitrait. */
  background: color-mix(in srgb, var(--stats-text-color, #ffffff) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #e4be63) 25%, transparent);
  color: color-mix(in srgb, var(--stats-text-color, #f7f3ea) 70%, transparent);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-btn.active {
  background: color-mix(in srgb, var(--chart-primary-color, #e4be63) 20%, transparent);
  border-color: var(--chart-primary-color, #e4be63);
  color: var(--header-text-color, #f2cc72);
}

.content {
  max-width: 560px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.pledge-notfound {
  max-width: 560px;
  margin: 40px auto 0;
  position: relative;
  z-index: 1;
}

.notfound-card {
  text-align: center;
  background: var(--theme-surface, rgba(255, 255, 255, 0.045));
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #e4be63) 22%, transparent);
  border-radius: 18px;
  padding: 36px 26px;
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}

.notfound-card h1 {
  font-size: 22px;
  margin: 0 0 10px;
  color: var(--header-text-color, #f2cc72);
}

.notfound-card p {
  font-size: 14px;
  color: color-mix(in srgb, var(--stats-text-color, #f7f3ea) 65%, transparent);
  margin: 0;
}

.header {
  text-align: center;
  margin-bottom: 28px;
}

.flame-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: linear-gradient(160deg, color-mix(in srgb, var(--chart-primary-color, #e4be63) 25%, transparent), color-mix(in srgb, var(--chart-primary-color, #e4be63) 5%, transparent));
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #e4be63) 40%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--header-text-color, #f2cc72);
  animation: flicker 2.4s ease-in-out infinite;
}

.flame-icon svg {
  width: 30px;
  height: 30px;
}

@keyframes flicker {
  0%, 100% { box-shadow: 0 0 22px color-mix(in srgb, var(--chart-primary-color, #e4be63) 35%, transparent); }
  50% { box-shadow: 0 0 40px color-mix(in srgb, var(--chart-primary-color, #e4be63) 65%, transparent); }
}

.kicker {
  font-size: 11px;
  letter-spacing: 4px;
  color: color-mix(in srgb, var(--header-text-color, #f2cc72) 80%, transparent);
  margin: 0 0 6px;
  font-weight: 700;
}

.org-name {
  font-size: 26px;
  margin: 0 0 4px;
  color: var(--header-text-color, #f2cc72);
  letter-spacing: 1px;
}

.title {
  font-size: 20px;
  font-weight: 500;
  margin: 0 0 10px;
  color: var(--stats-text-color, #f7f3ea);
}

.subtitle {
  font-size: 14px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--stats-text-color, #f7f3ea) 65%, transparent);
  margin: 0 auto;
  max-width: 440px;
}

.card {
  background: var(--theme-surface, rgba(255, 255, 255, 0.045));
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #e4be63) 22%, transparent);
  border-radius: 18px;
  padding: 24px 20px;
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  margin-bottom: 16px;
}

label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  color: color-mix(in srgb, var(--header-text-color, #f2cc72) 85%, transparent);
  margin-bottom: 7px;
  text-transform: uppercase;
}

/* Champs de saisie : surface FIGEE (fond + texte). On ne mele jamais un texte du
   theme a un fond fige — ici les deux sont fixes, donc la paire reste lisible et
   auto-coherente sur tout fond de theme (sombre ou Ivoire clair). Seul l'anneau
   de focus (un accent, pas du texte) suit le theme. */
input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(7, 9, 20, 0.6);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #f7f3ea;
  padding: 13px 14px;
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input::placeholder {
  color: rgba(247, 243, 234, 0.3);
}

input:focus {
  outline: none;
  border-color: var(--chart-primary-color, #e4be63);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--chart-primary-color, #e4be63) 12%, transparent);
}

/* Le nombre de montants est editable par l'admin, donc inconnu ici. Avec
   repeat(auto-fit, minmax(90px, 1fr)) le nombre de colonnes dependait de la
   largeur : 5 colonnes a 560 px, 4 vers 480 px, 3 sur mobile. Tout compte de
   montants valant "colonnes + 1" laissait alors un montant seul sur sa ligne
   (6 montants sur 5 colonnes, 5 sur 4, 4 sur 3). On fixe donc le nombre de
   colonnes, et la regle :last-child ci-dessous fait occuper toute la ligne au
   dernier montant s'il s'y retrouve seul — quel que soit le nombre de montants. */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.preset-grid > .preset:last-child:nth-child(3n + 1) {
  grid-column: 1 / -1;
}

/* Montant au repos : meme puits fige que les champs (fond + texte figes) — lisible
   sur tout fond. Selectionne, il prend l'accent PLEIN du theme (point 3) : fond
   opaque = --chart-primary-color, texte = --accent-contrast-text (noir ou blanc
   choisi par luminance, AA verifie sur les 7 themes). Le fond plein evite tout
   melange texte-du-theme / fond-fige. */
.preset {
  background: rgba(7, 9, 20, 0.6);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  color: #f7f3ea;
  border-radius: 10px;
  padding: 12px 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.preset:hover {
  border-color: color-mix(in srgb, var(--chart-primary-color, #e4be63) 60%, transparent);
}

.preset.selected {
  border-color: var(--chart-primary-color, #e4be63);
  background: var(--chart-primary-color, #e4be63);
  color: var(--accent-contrast-text, #131731);
  box-shadow: 0 0 18px color-mix(in srgb, var(--chart-primary-color, #e4be63) 25%, transparent);
}

.custom-wrapper {
  position: relative;
}

.currency {
  position: absolute;
  inset-inline-start: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(242, 204, 114, 0.8);
  font-weight: 700;
}

.custom-wrapper input {
  padding-inline-start: 34px;
}

.form-error {
  background: rgba(220, 60, 60, 0.15);
  border: 1px solid rgba(220, 60, 60, 0.4);
  color: #ff9d9d;
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 13px;
  margin-bottom: 14px;
}

/* CTA = accent PLEIN du theme (point 3). Degrade primaire-eclairci -> primaire :
   les DEUX bornes restent claires, donc --accent-contrast-text (noir sur les 7
   themes livres) passe AA partout — un degrade vers la couleur secondaire, souvent
   foncee, aurait casse le contraste sur la moitie du bouton. */
.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--chart-primary-color, #e4be63) 86%, white) 0%, var(--chart-primary-color, #c8922a) 100%);
  color: var(--accent-contrast-text, #131731);
  border: none;
  border-radius: 12px;
  padding: 16px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 8px 26px color-mix(in srgb, var(--chart-primary-color, #e4be63) 35%, transparent);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--chart-primary-color, #e4be63) 50%, transparent);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.amount-preview {
  text-align: center;
  margin: 14px 0 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--header-text-color, #f2cc72);
}

/* ===== Celebration ===== */
.celebration {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color, radial-gradient(ellipse at center, #1b2145 0%, #070914 70%));
  padding: 20px;
}

.confetti-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.confetti {
  position: absolute;
  top: -20px;
  border-radius: 2px;
  animation-name: confetti-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes confetti-fall {
  0% {
    transform: translateY(-30px) translateX(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) translateX(var(--drift)) rotate(var(--rotate));
    opacity: 0.75;
  }
}

.celebration-card {
  position: relative;
  z-index: 11;
  text-align: center;
  background: var(--theme-surface, rgba(255, 255, 255, 0.05));
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #e4be63) 35%, transparent);
  border-radius: 22px;
  padding: 44px 32px;
  max-width: 420px;
  width: 100%;
  backdrop-filter: blur(14px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 0 60px color-mix(in srgb, var(--chart-primary-color, #e4be63) 15%, transparent);
  animation: card-pop 0.6s cubic-bezier(0.18, 1.4, 0.4, 1);
}

@keyframes card-pop {
  0% { transform: scale(0.6); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.big-flame {
  width: 84px;
  height: 84px;
  margin: 0 auto 18px;
  border-radius: 50%;
  background: linear-gradient(160deg, color-mix(in srgb, var(--chart-primary-color, #e4be63) 35%, transparent), color-mix(in srgb, var(--chart-primary-color, #e4be63) 8%, transparent));
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #e4be63) 50%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--header-text-color, #ffd700);
  animation: flame-glow 1.8s ease-in-out infinite;
}

.big-flame svg {
  width: 44px;
  height: 44px;
}

@keyframes flame-glow {
  0%, 100% { box-shadow: 0 0 30px color-mix(in srgb, var(--chart-primary-color, #ffd700) 40%, transparent); transform: scale(1); }
  50% { box-shadow: 0 0 60px color-mix(in srgb, var(--chart-primary-color, #ffd700) 75%, transparent); transform: scale(1.05); }
}

.thank-title {
  font-size: 26px;
  margin: 0 0 10px;
  color: var(--header-text-color, #f2cc72);
}

/* Montant de remerciement (signature animee) : recolore via --header-text-color
   pour rester lisible quand le fond de la soiree est clair (Ivoire) ; le halo
   suit l'accent. L'animation de comptage est inchangee. */
.thank-amount {
  font-size: 42px;
  font-weight: 900;
  margin: 0 0 14px;
  color: var(--header-text-color, #ffd700);
  text-shadow: 0 0 30px color-mix(in srgb, var(--chart-primary-color, #ffd700) 45%, transparent);
}

.thank-message {
  font-size: 14px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--stats-text-color, #f7f3ea) 70%, transparent);
  margin: 0 0 26px;
}

.again-btn {
  max-width: 300px;
}

@media (max-width: 520px) {
  .field-row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  /* Deux colonnes sur mobile : meme garantie, un dernier montant impair
     occupe toute la ligne au lieu de rester seul dans sa colonne. */
  .preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .preset-grid > .preset:last-child:nth-child(3n + 1) {
    grid-column: auto;
  }

  .preset-grid > .preset:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .org-name {
    font-size: 22px;
  }

  .thank-amount {
    font-size: 34px;
  }
}
</style>
