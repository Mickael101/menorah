# Inventaire des divergences — fusion des 3 écrans display (C3)

Établi le 2026-07-27 sur `27599f6`, AVANT fusion. Chaque ligne cite les numéros de
ligne des trois forks. Colonnes : `main` = `DisplayPage.vue` (`/display`, 1165 l.),
`light` = `DisplayPage8.vue` (`/display-light`, 252 l.), `hidden` =
`DisplayHiddenPage.vue` (`/display-hidden`, 943 l.).

Légende décision :
- **PRÉSERVÉE** : divergence intentionnelle ou non tranchable → reproduite à l'identique par variante.
- **CONVERGE (défaut identique)** : les trois variantes adoptent le comportement de la
  source unique de configuration ; les valeurs par défaut rendent un pixel identique à
  l'existant. Amélioration invisible par défaut, déclarée.

## 1. Logique de script

| # | Aspect | main | light | hidden | Décision |
|---|---|---|---|---|---|
| S1 | Textes d'en-tête/statut/tableau | lus de `config.displaySettings.texts` (L35-38) | **codés en dur** MAJUSCULES (L119,132-133,137) | **codés en dur** Title Case (L171,196-197,204) | CONVERGE → tous lisent `config.texts`. Défauts = mêmes chaînes. Voir note casse (§6). |
| S2 | `textDirection` | `:dir` racine + spans (L39,187,236,263...) | absent | absent | CONVERGE → `:dir` partout (défaut `auto` = identique en latin). |
| S3 | `donationAnimation` passé à DonorPlateAnimation | oui (L40,209) | non (défauts) | non (défauts) | CONVERGE → props config partout ; défaut `prestige`/thankYou = identiques. |
| S4 | File d'attente des dons | oui (`donationQueue`, `nextDonationTimeoutId`, L50,90-108) | oui (L25,52-69) | **NON** (rejoue immédiatement, L47-64) | PRÉSERVÉE — hidden = « variante sans file d'attente » (architecture.md:92). Drapeau `queueDonations`. |
| S5 | Timeouts suivis + `onUnmounted` cleanup | oui (L53-55,164-169) | oui (L28-30,92-97) | **non** (`setTimeout` nu, pas de cleanup, L57,76) | Le générique suit et nettoie TOUJOURS (corrige une fuite, invisible). Non un drapeau. |

## 2. Fond et décor

| # | Aspect | main | light | hidden | Décision |
|---|---|---|---|---|---|
| B1 | Étoiles animées (`bg-effects`) | oui, opacité douce (conteneur 0.36 ; couches 0.62/0.46/0.5 ; modern 0.24 ; ceremonial 0.18) (L190-194,336-345) | **absent** | oui, opacité vive (couches 0.9/0.7/0.5) (L128-133,244-281) | Drapeaux séparés : `showStars` (light=false) ET `starsIntensity` ('soft'/'bright'). |
| B2 | Fond de page | composite radial+linéaire (L292-295) | plat `var(--bg-image),var(--bg-color)` (L148) | plat (L218) | Drapeau `backgroundStyle` ('composite'/'flat'). |
| B3 | Overlays de thème `::before` (premium/modern/ceremonial) | oui (L306-333) | non | non | Drapeau `themeOverlays` (light/hidden=false). |

## 3. Effet flash de don

| # | Aspect | main | light | hidden | Décision |
|---|---|---|---|---|---|
| F1 | Nature du flash | riche : rays+glow+particles (L197-203) | **simple** : un seul div `flash-pulse` (L107,149-151) | riche : rays+glow+particles (L153-159) | Drapeau `flashKind` ('rich'/'simple'). |
| F2 | Ancrage du flash riche | centre (`left:50%`, L440,511,543) | — | **`left:25%`** (L512,583,614) | PRÉSERVÉE (quirk non tranchable). Drapeau `flashAnchor` ('center'/'left'). |
| F3 | Nombre de particules flash | 12 (`v-for i in 12`, L201) | 0 | 20 (`v-for i in 20`, L157) | Drapeau numérique `flashParticleCount`. |

## 4. Explosion GIF (déclenchée admin)

| # | Aspect | main | light | hidden | Décision |
|---|---|---|---|---|---|
| G1 | Nb particules | 18 (L223) | 30 (L113) | 30 (L142) | Drapeau numérique `gifParticleCount`. |
| G2 | Couleurs | thème (`color-mix`, L1024,1043) | or codé en dur (L207,210) | or codé en dur (L339,373) | Drapeau `gifColorSource` ('theme'/'gold'). |
| G3 | Taille anneaux finaux | `150vw` (L1109) | `150vw` (L247) | **`800px`** fixe (L461-465) | Drapeau `gifRingSize` ('viewport'/'fixed'). |
| G4 | Taille GIF | 60vw/70vh (L1021-1022) | 60vw/70vh (L207) | **50vw/60vh** (L335) | Drapeau `gifSize` ('lg'/'md'). |

## 5. Contrôles techniques (statut / plein écran)

| # | Aspect | main | light | hidden | Décision |
|---|---|---|---|---|---|
| C1 | Style pastille statut | pastille thématisée `color-mix`, `left:100px`, 13px (L601-625) | **LED** rouge/vert codés `#CC0000`/`#008800`, 20px (L154-156) | **verre** rgba rouge/vert translucide, coin haut-droit (L672-695) | Drapeau `statusStyle` ('themed'/'led'/'glass'). |
| C2 | Bouton plein écran | 52px thématisé, stroke 2 (L640-664) | 60px surface thème, stroke 3 (L122-123,160-162) | 44px verre rgba, stroke 2 (L711-734) | Drapeau `fullscreenStyle` ('themed'/'led'/'glass'). |

## 6. En-tête gala et bloc tableau

| # | Aspect | main | light | hidden | Décision |
|---|---|---|---|---|---|
| H1 | Taille des polices d'en-tête | clamp médium (org 28-48px, L704-713) | **XXL** (org 34-70px, tracking 8px, L167-169) | small (org 16-28px, L773-781) | Drapeau `headerScale` ('md'/'xxl'/'sm') → classe variante. |
| H2 | Cadre visuel campagne | `campaign-visual-frame` bordé + `::after` (L254-258,755-776) | CampaignVisual nu dans section (L127-129) | CampaignVisual nu + styles `:deep` menorah (L189-191,812-834) | Drapeau `campaignFrame` (main=true). |
| H3 | Kicker du tableau (`boardKicker`) | oui (L272) | non | non | Drapeau **propre** `showBoardKicker`. |
| H4 | Compteur de donateurs (`donor-count`) | oui (L275-277) | non | non | Drapeau **propre** `showDonorCount` (jamais couplé à H3 — règle des contrôles divergents). |
| H5 | Casse des libellés | MAJUSCULES (source config défaut) | MAJUSCULES (source) | Title Case + `text-transform:uppercase` CSS (L770,778,865) | La casse finale suit config + `text-transform` par variante. Voir note ci-dessous. |

## 7. RTL / typographie

| # | Aspect | main | light | hidden | Décision |
|---|---|---|---|---|---|
| R1 | Correctif `:dir(rtl) letter-spacing:normal` | oui (L723-729) | non | non | Appliqué dans le générique aux classes tracées (invisible en latin ; corrige l'hébreu). CONVERGE. |
| R2 | `prefers-reduced-motion` | oui (L1146-1164) | **non** | **non** | Le générique porte UN bloc reduced-motion couvrant tout (light/hidden gagnent la garde ; aucune régression). |

## Note de casse (H5 / S1)

Le seul écart de rendu visible introduit par la convergence S1 concerne la **pastille de
statut** de `light` et `hidden` : elles affichaient respectivement « EN DIRECT » et « En
direct » codés en dur, sans `text-transform`. Après fusion elles lisent
`config.texts.liveLabel` (défaut « EN DIRECT »). Pour `hidden` cela change « En direct » →
« EN DIRECT ». **Écart déclaré intentionnel** : conformité à la convention « tout texte
affiché est configurable, le serveur est la source unique » (CLAUDE.md), et corrige le fait
que le kicker hébreu (item E1) ne se propageait pas aux variantes light/hidden. Les en-têtes
gala et le titre du tableau restent visuellement identiques (déjà en capitales par
`text-transform` ou par la valeur source).

## Récapitulatif des drapeaux d'adaptateur

`queueDonations`, `showStars`, `starsIntensity`, `backgroundStyle`, `themeOverlays`,
`flashKind`, `flashAnchor`, `flashParticleCount`, `gifParticleCount`, `gifColorSource`,
`gifRingSize`, `gifSize`, `statusStyle`, `fullscreenStyle`, `headerScale`, `campaignFrame`,
`showBoardKicker`, `showDonorCount`.

Chaque contrôle divergent possède SON drapeau ; aucun booléen unique ne pilote une paire
(cf. `showBoardKicker` vs `showDonorCount`).
