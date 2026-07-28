# Atelier Scènes — scènes animées pilotées par les dons

**Date** : 2026-07-28
**Statut** : design validé, à planifier
**Portée** : v1 — pipeline de fabrication hors app + lecture pilotée dans l'app + première scène réelle (bâtiment)
**Références** : POC `D:\Menora\artifacts\building-svg-poc\` (22 zones architecturales, `scene-manifest.json`) ; décisions Engram #3299 (animation architecturale) et #3746 (Rive + génération d'image multi-fournisseurs)

---

## 1. Contexte et objectif

L'écran de salle propose trois visuels (`none`, `menorah`, `custom`). La menorah est le seul
visuel **vivant** : elle s'illumine au fil des dons, mais elle est codée en dur
(`frontend/src/components/display/MenorahDisplay.vue` — masques SVG + GSAP). Le mode `custom`
n'est qu'une image inerte (`CampaignVisual.vue` → `<img>`).

L'Atelier Scènes transforme cette capacité en prestation : à partir d'une photo ou d'un rendu
du bâtiment d'un client, fabriquer une **scène animée** qui s'illumine progressivement avec
les dons, puis la jouer dans l'app comme n'importe quel réglage de soirée.

Chaîne visée : photo → SVG → zones → animation → scène jouée en direct. La fabrication est
une prestation facturée à part, réalisée par l'organisateur.

---

## 2. Décisions validées (2026-07-28)

| Sujet | Décision |
|---|---|
| Fondation animation | **Rive** (state machine + runtime web officiel) |
| Génération d'image | Aucun lock-in : OpenAI, Google ou Midjourney selon le besoin, hors app |
| Lieu de fabrication | **Hors app, outillée** — pipeline local + Rive Editor ; l'app ne fait que recevoir et jouer |
| Contrat app ↔ scène | **Un seul input `progress` (0–100)** ; zones, seuils et animations vivent dans le `.riv` |
| Cible v1 | La **scène bâtiment réelle** (source du POC), uploadée, activable, pilotée en prod |
| Rôles | Upload et suppression de scène = **organisateur** (token global). Activation par soirée = admin de soirée. |

---

## 3. Volet A — l'Atelier (hors app)

Dossier `D:\Menora\atelier-scenes\` — jamais déployé, hors du dépôt applicatif.
Contenu : runbook pas-à-pas + scripts + sorties intermédiaires par scène.

| Étape | Outil | Sortie |
|---|---|---|
| 1. Préparation image | Manuel, IA au besoin (OpenAI/Google/Midjourney) | image nette, cadrée, fond neutre |
| 2. Vectorisation | vtracer (validé par le POC) | SVG brut (~2 800 chemins sur le POC) |
| 3. Simplification | SVGO + regroupement en calques nommés par zone | SVG léger (**budget < 500 chemins**) |
| 4. Animation | Rive Editor (import du SVG simplifié) | timelines par zone + state machine `Scene` |
| 5. Export | Rive Editor | `<nom>.riv` + vignette + fiche scène |

Les 22 zones et seuils du POC (`scene-manifest.json`) servent de référence pour la première
scène (ordre d'illumination du bas vers le haut : socle → vitrages → entrée → claustra →
balcon → niveaux → façade haute → travées).

### Contrat de scène (le point de couplage unique)

- Artboard unique ; state machine nommée `Scene` ; input number `progress` (0–100).
- Les seuils d'illumination sont bakés dans la state machine — changer un seuil = ré-export.
- Transitions sobres (≤ 2 s, sans flash) : l'écran tourne des heures en soirée.
- Pas de boucle d'animation agressive en régime établi.
- Le `.riv` est autonome : aucun asset externe.

Ce contrat est documenté deux fois : dans le runbook de l'Atelier (côté fabrication) et dans
`docs/api-et-socket.md` (côté app, au moment du code).

---

## 4. Volet B — l'app

### Backend

- Table `scenes` (id, nom, nom de fichier, date de création) ; fichiers sous
  `DATA_DIR/scenes/`, servis statiquement.
- Routes organisateur : `POST /api/scenes` (multipart, validation des magic bytes `RIVE`,
  taille max 10 Mo), `GET /api/scenes`, `DELETE /api/scenes/:id`.
- `displaySettings` : `visualMode` accepte `'scene'` **en plus** des trois modes existants
  (`none`/`menorah`/`custom` restent inchangés) + nouveau champ `sceneId`, validé serveur
  (la scène doit exister), normalisé dans le blob comme `celebrations`.
- Self-healing : suppression d'une scène référencée → les soirées concernées repassent en
  `visualMode: 'none'`.

### Admin

- Onglet « Écran de salle » : choix « Scène animée » + sélecteur dans la bibliothèque de scènes.
- Gestion de la bibliothèque (upload, suppression) : réservée à l'organisateur.

### Écran

- Nouveau `SceneDisplay.vue` à côté de `MenorahDisplay.vue`, monté par `CampaignVisual`
  quand `mode === 'scene'`.
- Runtime `@rive-app/canvas` chargé en **import dynamique** — l'écran ne paie rien hors
  mode scène.
- Liaison : % de l'objectif (snapshot serveur, dérivé de `goalAmount` dans
  `event_configs`) → input `progress`, **clampé à 100** côté écran (les dons peuvent
  dépasser l'objectif ; la scène, elle, s'arrête à « tout illuminé »), mis à jour à chaque
  événement socket.
- Instance Rive détruite à l'unmount.

---

## 5. Flux de données

Don saisi → le serveur recalcule le % de l'objectif → broadcast Socket.IO → `SceneDisplay`
pousse la valeur dans `progress` → la state machine franchit ses seuils → les zones
s'illuminent. L'admin ne calcule rien de visuel (règle du dépôt : le serveur est la seule
source de vérité).

---

## 6. Erreurs et robustesse

| Cas | Comportement |
|---|---|
| `.riv` introuvable ou corrompu au chargement | retombée silencieuse sur le visuel `none` + `console.warn` — jamais de crash en soirée |
| Upload non-RIVE ou trop gros | 400 avec message |
| Activation avec `sceneId` inexistant | 400 |
| Scène supprimée alors que référencée | soirées repassées en `none` (même patron que les médias de célébration supprimés) |
| `prefers-reduced-motion` | `progress` appliqué directement, pas d'animation d'entrée |

---

## 7. Tests et vérification

- Backend (vitest + supertest) : auth des trois routes, validation d'upload, activation avec
  `sceneId` inexistant, self-healing à la suppression.
- Frontend : `vue-tsc` ; test de `SceneDisplay` avec runtime Rive mocké (propagation de
  `progress`, fallback en erreur).
- Vérification navigateur (playwright-cli) : la vraie `building.riv`, dons simulés, captures
  à 0 / 60 / 100 % (parité avec les captures du POC).
- Gate habituel : `cd backend && npm test` + `npm run build` + `vue-tsc` côté frontend.

---

## 8. Hors scope v1 (YAGNI)

Éditeur de zones dans l'admin · seuils modifiables sans ré-export · sponsoring d'une zone
individuelle (réservation nominative type « mots premium ») · scène sur `/don` · génération
d'image automatisée dans l'app · multi-scènes par soirée.

Le contrat à un seul input rend ces extensions possibles en v2 sans casser l'existant.

---

## 9. Risques et points de vigilance

| Risque | Parade |
|---|---|
| SVG vtracer trop lourd pour Rive Editor (2 822 chemins sur le POC) | étape de simplification obligatoire (SVGO + regroupement), budget < 500 chemins avant import |
| Plan Rive Editor (gratuit vs payant) | à confirmer à la première fabrication ; le runtime web, lui, est open source (MIT) |
| Poids et perf du runtime sur TV de salle | `@rive-app/canvas` (renderer canvas 2D, le plus compatible), import dynamique |
| Écran allumé des heures | règle « pas de boucle agressive » dans le contrat de scène |

---

## 10. Critère de « terminé » v1

1. Runbook + scripts de l'Atelier exécutés une fois pour de vrai : `building.riv` existe et
   respecte le contrat.
2. Upload par l'organisateur, activation sur une soirée de test, écran illuminé en direct par
   des dons simulés — prouvé par captures dans `docs/verif/`.
3. Gate vert (tests backend + les deux builds) ; documentation synchronisée au moment du code
   (`docs/README.md`, `api-et-socket.md`, `historique.md`).
