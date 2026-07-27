// Primitives d'animation partagees par les ecrans display (C4).
//
// Ce module centralise les animations pilotees en JavaScript — a ce jour, le
// SEUL comportement dupplique etait le comptage anime (tween en requestAnimationFrame)
// present a l'identique dans StatsCompact.vue (total) et DonorPlateAnimation.vue
// (montant de la plaque). Les deux consommateurs appellent desormais animateValue().
//
// Les autres animations sont deja centralisees la ou elles doivent vivre et ne
// gagnent rien a etre deplacees ici (ce ne sont pas du JS) :
//   - presets de la plaque (prestige / confetti / ribbons / minimal) : keyframes
//     CSS dans DonorPlateAnimation.vue, selectionnes par la classe animation-*.
//   - flash de don, explosion GIF, etoiles de fond : keyframes CSS dans
//     DisplayScreen.vue, parametres par variante.
// C'est pourquoi aucune dependance (@formkit/auto-animate) n'est ajoutee : il n'y
// a pas d'animation de liste (ajout/retrait avec reflow) a orchestrer ici — la
// grille de donateurs defile par transform, pas par insertion DOM animee (YAGNI).

export type EasingFn = (progress: number) => number;

export const easeOutCubic: EasingFn = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuart: EasingFn = (t) => 1 - Math.pow(1 - t, 4);

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export interface AnimateValueOptions {
  from: number;
  to: number;
  duration?: number;
  easing?: EasingFn;
  onUpdate: (value: number) => void;
  // Arrondit chaque frame (montants en agorot : toujours entiers a l'affichage).
  round?: boolean;
  // Sous prefers-reduced-motion, saute directement a la valeur finale.
  respectReducedMotion?: boolean;
}

// Anime une valeur numerique de `from` vers `to` en requestAnimationFrame.
// Retourne une fonction d'annulation (a appeler avant de relancer ou au demontage).
export function animateValue(options: AnimateValueOptions): () => void {
  const {
    from,
    to,
    duration = 1000,
    easing = easeOutCubic,
    onUpdate,
    round = true,
    respectReducedMotion = true
  } = options;

  const emit = (value: number): void => onUpdate(round ? Math.round(value) : value);

  if (respectReducedMotion && prefersReducedMotion()) {
    emit(to);
    return () => {};
  }

  const startedAt = performance.now();
  let frame: number | null = null;

  const step = (now: number): void => {
    const progress = Math.min((now - startedAt) / duration, 1);
    emit(from + (to - from) * easing(progress));
    if (progress < 1) {
      frame = window.requestAnimationFrame(step);
    } else {
      frame = null;
    }
  };

  frame = window.requestAnimationFrame(step);

  return () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };
}
