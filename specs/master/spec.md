# Feature Specification: Système de Visualisation des Dons en Temps Réel

**Feature Branch**: `master`
**Created**: 2025-01-26
**Status**: Draft
**Input**: Besoin client – Menorah lumineuse, graphique évolutif, plaques donateurs.

---

## User Scenarios & Testing

### User Story 1 - Saisie d'un Don (Priority: P1)

L'administrateur saisit un don via le panel : nom, prénom, montant (prédéfini ou libre), et une référence optionnelle.

**Why this priority**: Action fondamentale déclenchant toutes les visualisations.

**Independent Test**: Vérifier qu'un don saisi apparaît en base et déclenche un événement temps réel.

**Acceptance Scenarios**:
1. Given le panel admin est ouvert, When l'admin saisit nom="Cohen", montant=180€, Then le don est enregistré et l'événement est émis.
2. Given un montant prédéfini est sélectionné, When l'admin valide, Then le don est enregistré sans saisie manuelle.
3. Given le champ montant est vide, When l'admin valide, Then une erreur s'affiche.
4. Given un don existant est modifié, When l'admin sauvegarde, Then les animations sont recalculées correctement.

---

### User Story 2 - Animation Menorah (Priority: P1)

La menorah (fichier SVG segmenté) s'illumine progressivement du bas vers le haut selon le total collecté.
Chaque segment représente un niveau d'illumination.

**Correction** : Aucun mot n'est illuminé — seule la forme de la menorah évolue.

**Independent Test**: Simuler des montants et vérifier que les segments correspondants s'illuminent.

**Acceptance Scenarios**:
1. Given total=0€ et seuil niveau 1=1000€, When un don de 500€ arrive, Then 50% du niveau 1 s'illumine.
2. Given total dépasse le seuil final, When une mise à jour arrive, Then la menorah reste à 100%.
3. Given une mise à jour temps réel, When l'animation s'exécute, Then la transition est fluide (~1 seconde, 60fps).

---

### User Story 3 - Graphique Évolutif (Priority: P2)

Un graphique affiche le total en temps réel et s'anime à chaque don.

**Independent Test**: Envoyer des mises à jour et vérifier l'animation du compteur/graphique.

**Acceptance Scenarios**:
1. Given total=5000€, When un don de 200€ arrive, Then le compteur anime vers 5200€.
2. Given une barre de progression, When le total augmente, Then la largeur augmente proportionnellement.

---

### User Story 4 - Plaques Donateurs (Priority: P2)

Chaque donateur apparaît sous forme de plaque animée.

**Independent Test**: Ajouter un don et vérifier l'apparition animée.

**Acceptance Scenarios**:
1. Given la liste est affichée, When un nouveau don arrive, Then une plaque apparaît avec animation.
2. Given 50 plaques, When une nouvelle arrive, Then le tableau défile automatiquement.

---

### User Story 5 - Configuration Admin (Priority: P3)

L'admin configure : seuils d'illumination, segments SVG, montants prédéfinis, paramètres visuels.

**Independent Test**: Modifier un seuil et vérifier la réaction de la menorah.

**Acceptance Scenarios**:
1. Given la config est ouverte, When l'admin modifie seuil niveau 1, Then la menorah recalcule son illumination.
2. Given le SVG est remplacé/édité, When l'admin sauvegarde, Then les nouveaux segments sont pris en compte.

---

### Edge Cases

- Deux dons arrivent simultanément.
- Un don est modifié ou supprimé.
- Perte de connexion temps réel.
- Total supérieur au maximum prévu → illumination = 100%.
- Segment SVG manquant ou mal identifié dans le fichier.

---

## Requirements

### Functional Requirements

- **FR-001**: Le système DOIT permettre la saisie de dons avec nom, prénom, montant et référence optionnelle.
- **FR-002**: Montants prédéfinis + montant libre.
- **FR-003**: La menorah DOIT être segmentée et s'illuminer de bas en haut.
- **FR-004**: Les seuils d'illumination doivent être configurables.
- **FR-005**: Le graphique DOIT afficher le total en temps réel avec animation.
- **FR-006**: Les plaques DOIVENT apparaître avec animation pour chaque don.
- **FR-007**: Tout changement (ajout/modification/suppression) DOIT recalculer instantanément les 3 visualisations.
- **FR-008**: L'admin DOIT pouvoir modifier la configuration sans intervention technique.

---

## Key Entities

- **Donation**: nom, prénom, montant, référence (option), timestamp, statut.
- **MenorahSegments**: niveaux, seuils associés, état lumineux.
- **VisualSettings**: couleurs, durées, intensité, styles.
- **Config**: seuils, montants prédéfinis, objectifs.

---

## Success Criteria

- **SC-001**: Mise à jour des 3 animations < 1 seconde.
- **SC-002**: Animations Menorah à 60fps.
- **SC-003**: Support de 100+ dons sans ralentissement.
- **SC-004**: Configuration admin complète sans intervention technique.
