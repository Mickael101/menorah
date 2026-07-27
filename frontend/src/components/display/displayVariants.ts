// Descripteurs de variante des ecrans display (C3).
//
// Les trois routes /display, /display-light et /display-hidden montaient jusqu'ici
// trois forks quasi identiques (2 360 lignes cumulees). DisplayScreen.vue est
// desormais l'unique implementation ; chaque route lui passe l'un des descripteurs
// ci-dessous via un wrapper mince (DisplayPage.vue / DisplayPage8.vue /
// DisplayHiddenPage.vue conserves pour router.ts).
//
// REGLE DES CONTROLES DIVERGENTS : chaque bloc/controle qui divergeait entre les
// forks recoit SON propre drapeau. Jamais un booleen unique qui piloterait une
// paire (source classique de boutons fantomes inter-variantes). C'est pourquoi,
// par exemple, `showBoardKicker` et `showDonorCount` sont deux drapeaux distincts,
// et la couleur du flash / de l'explosion GIF est scindee en `*ParticleColor` et
// `*GlowColor` (la variante « hidden » melange particules-theme + lueur-or).
//
// L'inventaire ligne-a-ligne qui justifie chaque valeur est dans
// docs/verif/sprint-2026-07-27/display-fusion/inventaire-divergences.md.

export type DisplayVariantName = 'main' | 'light' | 'hidden';

export interface DisplayVariant {
  name: DisplayVariantName;

  // Comportement
  // main/light empilent les dons rapproches ; hidden rejoue immediatement
  // (« variante sans file d'attente » — architecture.md).
  queueDonations: boolean;

  // Fond et decor
  showStars: boolean;
  starsIntensity: 'soft' | 'bright';
  backgroundStyle: 'composite' | 'flat';
  themeOverlays: boolean;

  // Flash de don
  flashKind: 'rich' | 'simple';
  flashAnchor: 'center' | 'left';
  flashParticleCount: number;
  flashGlowColor: 'theme' | 'gold';

  // Explosion GIF (declenchee admin)
  gifParticleCount: number;
  gifParticleColor: 'theme' | 'gold';
  gifGlowColor: 'theme' | 'gold';
  gifRingSize: 'viewport' | 'fixed';
  gifSize: 'lg' | 'md';

  // Controles techniques
  statusStyle: 'themed' | 'led' | 'glass';
  fullscreenStyle: 'themed' | 'led' | 'glass';

  // En-tete et tableau
  headerScale: 'md' | 'xxl' | 'sm';
  campaignFrame: boolean;
  showBoardKicker: boolean;
  showDonorCount: boolean;
}

// /display — ecran principal (ex-DisplayPage.vue, 1165 l.)
export const MAIN_VARIANT: DisplayVariant = {
  name: 'main',
  queueDonations: true,
  showStars: true,
  starsIntensity: 'soft',
  backgroundStyle: 'composite',
  themeOverlays: true,
  flashKind: 'rich',
  flashAnchor: 'center',
  flashParticleCount: 12,
  flashGlowColor: 'theme',
  gifParticleCount: 18,
  gifParticleColor: 'theme',
  gifGlowColor: 'theme',
  gifRingSize: 'viewport',
  gifSize: 'lg',
  statusStyle: 'themed',
  fullscreenStyle: 'themed',
  headerScale: 'md',
  campaignFrame: true,
  showBoardKicker: true,
  showDonorCount: true
};

// /display-light — variante LED geant, police XXL (ex-DisplayPage8.vue, 252 l.)
export const LIGHT_VARIANT: DisplayVariant = {
  name: 'light',
  queueDonations: true,
  showStars: false,
  starsIntensity: 'soft',
  backgroundStyle: 'flat',
  themeOverlays: false,
  flashKind: 'simple',
  flashAnchor: 'center',
  flashParticleCount: 0,
  flashGlowColor: 'theme',
  gifParticleCount: 30,
  gifParticleColor: 'gold',
  gifGlowColor: 'gold',
  gifRingSize: 'viewport',
  gifSize: 'lg',
  statusStyle: 'led',
  fullscreenStyle: 'led',
  headerScale: 'xxl',
  campaignFrame: false,
  showBoardKicker: false,
  showDonorCount: false
};

// /display-hidden — variante sans file d'attente (ex-DisplayHiddenPage.vue, 943 l.)
export const HIDDEN_VARIANT: DisplayVariant = {
  name: 'hidden',
  queueDonations: false,
  showStars: true,
  starsIntensity: 'bright',
  backgroundStyle: 'flat',
  themeOverlays: false,
  flashKind: 'rich',
  flashAnchor: 'left',
  flashParticleCount: 20,
  flashGlowColor: 'gold',
  gifParticleCount: 30,
  gifParticleColor: 'theme',
  gifGlowColor: 'gold',
  gifRingSize: 'fixed',
  gifSize: 'md',
  statusStyle: 'glass',
  fullscreenStyle: 'glass',
  headerScale: 'sm',
  campaignFrame: false,
  showBoardKicker: false,
  showDonorCount: false
};
