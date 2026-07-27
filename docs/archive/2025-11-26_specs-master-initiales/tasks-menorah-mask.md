# Tasks: Illumination Dynamique Menorah via Mask SVG

**Input**: Design documents from `/specs/master/`
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Tests are OPTIONAL for this project (per constitution: "Tests Recommended").

**Organization**: Tasks implement the new mask-based illumination system for User Story 2 (Menorah Animation).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US2 for all - Menorah Animation)
- Exact file paths included

---

## Phase 1: Setup - SVG & Dependencies

**Purpose**: Prepare the new SVG structure and install animation library

- [ ] T001 Install GSAP animation library in `frontend/package.json`
- [ ] T002 [P] Backup current menorah.svg to `frontend/public/assets/menorah-segmented-backup.svg`
- [ ] T003 [P] Create new menorah mask SVG at `frontend/public/assets/menorah.svg`

---

## Phase 2: New SVG Structure with Mask

**Purpose**: Transform the menorah SVG to use mask-based illumination

### Implementation

- [ ] T004 [US2] Create SVG with `<defs>` containing `<mask id="menorahMask">` in `frontend/public/assets/menorah.svg`
- [ ] T005 [US2] Convert all menorah shapes to white fill inside the mask (visible zones)
- [ ] T006 [US2] Create animated gradient definition `<linearGradient id="lightGradient">` in SVG defs
- [ ] T007 [US2] Add light layer `<rect>` with gradient fill and mask applied
- [ ] T008 [US2] Add glow effects using `<filter id="glowFilter">` with feGaussianBlur

**Checkpoint**: SVG structure complete with mask, gradient, and glow filter

---

## Phase 3: User Story 2 - MenorahDisplay Component Refactor (Priority: P1)

**Goal**: Replace segment-based illumination with mask-based gradient animation

**Independent Test**: Set progress to 50% and verify gradient fills bottom half of menorah shape

### Implementation for Mask-Based Illumination

- [ ] T009 [US2] Create new MenorahMaskDisplay component at `frontend/src/components/display/MenorahMaskDisplay.vue`
- [ ] T010 [US2] Implement inline SVG with mask structure in component template
- [ ] T011 [US2] Create `setProgress(percent: number)` function using GSAP to animate gradient offset
- [ ] T012 [US2] Implement ascending gradient animation (bottom to top illumination)
- [ ] T013 [US2] Add glow intensity animation based on progress level
- [ ] T014 [US2] Wire component to useDonations composable for stats.percentComplete
- [ ] T015 [US2] Handle Socket.IO events to trigger smooth animation transitions
- [ ] T016 [US2] Add CSS will-change optimization for 60fps performance

**Checkpoint**: MenorahMaskDisplay animates smoothly based on donation percentage

---

## Phase 4: Edge Cases & Polish

**Purpose**: Handle edge cases and optimize performance

### Edge Case Handling

- [ ] T017 [US2] Handle progress > 100% by capping gradient at top position
- [ ] T018 [US2] Handle progress = 0% with fully dark/unlit state
- [ ] T019 [US2] Ensure mask is applied before first animation frame (no flash)
- [ ] T020 [US2] Make gradient responsive to SVG container resize

### Visual Enhancements

- [ ] T021 [P] [US2] Add phosphorescence effect (subtle pulsing glow at current level)
- [ ] T022 [P] [US2] Add shimmer effect on gradient leading edge
- [ ] T023 [US2] Configure glow color and intensity as props

### Performance Optimization

- [ ] T024 [US2] Verify 60fps animation in Chrome DevTools Performance tab
- [ ] T025 [US2] Add requestAnimationFrame fallback if GSAP unavailable
- [ ] T026 [US2] Debounce rapid donation updates (multiple donations < 100ms apart)

**Checkpoint**: All edge cases handled, visual effects polished, 60fps verified

---

## Phase 5: Integration & Cleanup

**Purpose**: Replace old component and clean up

- [ ] T027 Replace MenorahDisplay import with MenorahMaskDisplay in `frontend/src/pages/DisplayPage.vue`
- [ ] T028 Update MenorahDisplay.vue to re-export MenorahMaskDisplay for backwards compatibility
- [ ] T029 Remove segment illumination logic from old MenorahDisplay (keep as fallback)
- [ ] T030 Update useDonations to remove litSegments dependency (use percentComplete only)
- [ ] T031 Test full flow: Add donation → Socket event → Gradient animation
- [ ] T032 Run quickstart.md validation (manual test)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (SVG Structure)
    ↓
Phase 3 (Component Implementation) ← CORE FEATURE
    ↓
Phase 4 (Edge Cases & Polish)
    ↓
Phase 5 (Integration)
```

### Task Dependencies

- T003 depends on T002 (backup first)
- T009 depends on T001 (GSAP installed)
- T010-T016 sequential within component
- T017-T020 can start after T016
- T021-T023 parallel polish tasks
- T027-T032 sequential integration

### Within Component Implementation

- Inline SVG template → Progress function → Animation → Socket wiring → Performance

---

## Parallel Opportunities

### Phase 1 (Setup)

```bash
# These can run in parallel:
T002, T003  # Backup and new file creation
```

### Phase 4 (Polish)

```bash
# These can run in parallel:
T021, T022  # Visual effects (different concerns)
```

---

## Implementation Strategy

### MVP First (Phases 1-3)

1. Complete Phase 1: Setup (GSAP, backup, new SVG)
2. Complete Phase 2: SVG Structure
3. Complete Phase 3: Core component
4. **STOP**: Test gradient animation with hardcoded progress values
5. Verify 60fps before proceeding

### Incremental Delivery

1. **MVP**: Basic gradient illumination working with progress
2. **+Edge Cases**: Handle 0%, 100%+, resize
3. **+Polish**: Glow, shimmer, phosphorescence effects
4. **+Integration**: Replace old component

---

## Technical Notes

### SVG Mask Structure

```svg
<svg viewBox="0 0 400 500">
  <defs>
    <mask id="menorahMask">
      <!-- All menorah shapes with fill="white" -->
    </mask>
    <linearGradient id="lightGradient" x1="0" y1="1" x2="0" y2="0">
      <stop id="lightStop1" offset="0%" stop-color="#ffd700"/>
      <stop id="lightStop2" offset="100%" stop-color="transparent"/>
    </linearGradient>
    <filter id="glowFilter">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Light layer with mask -->
  <rect
    width="100%" height="100%"
    fill="url(#lightGradient)"
    mask="url(#menorahMask)"
    filter="url(#glowFilter)"
  />
</svg>
```

### GSAP Animation Example

```typescript
import gsap from 'gsap';

function setProgress(percent: number): void {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const offset = 100 - clampedPercent; // Gradient offset (100% = bottom, 0% = top)

  gsap.to('#lightStop2', {
    attr: { offset: `${offset}%` },
    duration: 1,
    ease: 'power2.out'
  });
}
```

### Key Files

| File | Purpose |
|------|---------|
| `frontend/public/assets/menorah.svg` | New mask-based SVG |
| `frontend/src/components/display/MenorahMaskDisplay.vue` | New component |
| `frontend/src/pages/DisplayPage.vue` | Integration point |
| `frontend/src/composables/useDonations.ts` | Data source |

---

## Estimated Task Counts

| Phase | Tasks | Parallel |
|-------|-------|----------|
| Setup | 3 | 2 |
| SVG Structure | 5 | 0 |
| Component Implementation | 8 | 0 |
| Edge Cases & Polish | 10 | 2 |
| Integration | 6 | 0 |
| **TOTAL** | **32** | **4** |

---

## Notes

- [P] tasks = different files, no dependencies
- [US2] label = all tasks belong to User Story 2 (Menorah Animation)
- GSAP preferred for smooth 60fps animations
- CSS variables can be used as fallback
- Constitution: KISS, YAGNI, Clean Code - keep effects simple but premium
- Backup old SVG before replacement
