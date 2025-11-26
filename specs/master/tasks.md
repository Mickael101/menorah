# Tasks: Système de Visualisation des Dons

**Input**: Design documents from `/specs/master/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/

**Tests**: Tests are OPTIONAL for this project (per constitution: "Tests Recommended").

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4, US5)
- Exact file paths included

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [x] T001 Create backend directory structure: `backend/src/{models,services,routes,db}/`
- [x] T002 Create frontend directory structure: `frontend/src/{components/{admin,display},composables}/`
- [x] T003 [P] Initialize backend package.json with TypeScript, Express, Socket.IO, better-sqlite3
- [x] T004 [P] Initialize frontend package.json with Vue 3, Vite, TypeScript
- [x] T005 [P] Create backend tsconfig.json with strict mode
- [x] T006 [P] Create frontend vite.config.ts with Vue plugin
- [x] T007 Create shared types file in `backend/src/models/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by ALL user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Create database initialization in `backend/src/db/init.ts` (donations + config tables)
- [x] T009 Create Donation model interface in `backend/src/models/donation.ts`
- [x] T010 [P] Create Config model interface in `backend/src/models/config.ts`
- [x] T011 [P] Create DonationStats interface in `backend/src/models/stats.ts`
- [x] T012 Implement DonationService with CRUD + stats calculation in `backend/src/services/donation.service.ts`
- [x] T013 Implement ConfigService (get/update config) in `backend/src/services/config.service.ts`
- [x] T014 Implement SocketService for real-time events in `backend/src/services/socket.service.ts`
- [x] T015 Create Express app with Socket.IO setup in `backend/src/index.ts`
- [x] T016 Create Vue app entry point with router in `frontend/src/main.ts`
- [x] T017 [P] Create App.vue with router-view in `frontend/src/App.vue`
- [x] T018 [P] Create useSocket composable in `frontend/src/composables/useSocket.ts`
- [x] T019 [P] Create useDonations composable in `frontend/src/composables/useDonations.ts`

**Checkpoint**: Backend API running, frontend app scaffolded, Socket.IO connected

---

## Phase 3: User Story 1 - Saisie d'un Don (Priority: P1)

**Goal**: Admin can create, edit, delete donations via panel

**Independent Test**: Create a donation and verify it appears in database + Socket event emitted

### Implementation for User Story 1

- [x] T020 [US1] Create donations routes (GET, POST, PUT, DELETE) in `backend/src/routes/donations.ts`
- [x] T021 [US1] Create stats route (GET /api/stats) in `backend/src/routes/stats.ts`
- [x] T022 [US1] Register routes in Express app in `backend/src/index.ts`
- [x] T023 [US1] Create DonationForm component in `frontend/src/components/admin/DonationForm.vue`
- [x] T024 [US1] Create DonationList component (edit/delete) in `frontend/src/components/admin/DonationList.vue`
- [x] T025 [US1] Create AdminPanel page in `frontend/src/pages/AdminPanel.vue`
- [x] T026 [US1] Add /admin route in `frontend/src/router.ts`
- [x] T027 [US1] Wire Socket events for donation:new/updated/deleted in AdminPanel

**Checkpoint**: Admin can CRUD donations, real-time events fire correctly

---

## Phase 4: User Story 2 - Animation Menorah (Priority: P1)

**Goal**: Menorah SVG illuminates progressively based on total collected

**Independent Test**: Simulate donations and verify correct segments light up

### Implementation for User Story 2

- [x] T028 [US2] Create sample Menorah SVG with segments in `frontend/public/assets/menorah.svg`
- [x] T029 [US2] Create MenorahDisplay component in `frontend/src/components/display/MenorahDisplay.vue`
- [x] T030 [US2] Implement segment illumination logic (CSS classes .lit/.unlit)
- [x] T031 [US2] Add CSS transitions for smooth 60fps animations in MenorahDisplay
- [x] T032 [US2] Wire Socket events to update Menorah on donation changes

**Checkpoint**: Menorah animates correctly when donations change

---

## Phase 5: User Story 3 - Graphique Évolutif (Priority: P2)

**Goal**: Animated counter/progress bar showing total donations

**Independent Test**: Send donation updates and verify counter animates smoothly

### Implementation for User Story 3

- [x] T033 [US3] Create TotalCounter component in `frontend/src/components/display/TotalCounter.vue`
- [x] T034 [US3] Implement animated number transition (requestAnimationFrame)
- [x] T035 [US3] Create ProgressBar component in `frontend/src/components/display/ProgressBar.vue`
- [x] T036 [US3] Wire Socket events to update counter/bar on donation changes

**Checkpoint**: Counter and progress bar animate on donation updates

---

## Phase 6: User Story 4 - Plaques Donateurs (Priority: P2)

**Goal**: Donor plates appear with animation for each donation

**Independent Test**: Add donation and verify plate appears with entrance animation

### Implementation for User Story 4

- [x] T037 [US4] Create DonorPlate component in `frontend/src/components/display/DonorPlate.vue`
- [x] T038 [US4] Create DonorPlatesGrid component in `frontend/src/components/display/DonorPlatesGrid.vue`
- [x] T039 [US4] Implement entrance animation (CSS keyframes: halo, fade-in)
- [x] T040 [US4] Implement auto-scroll when new plate added
- [x] T041 [US4] Wire Socket events to add/update plates on donation changes

**Checkpoint**: Donor plates appear with animation, grid auto-scrolls

---

## Phase 7: User Story 5 - Configuration Admin (Priority: P3)

**Goal**: Admin can configure thresholds, preset amounts, visual settings

**Independent Test**: Change goal amount and verify Menorah recalculates illumination

### Implementation for User Story 5

- [x] T042 [US5] Create config routes (GET, PUT) in `backend/src/routes/config.ts`
- [x] T043 [US5] Register config routes in Express app
- [x] T044 [US5] Create ConfigPanel component in `frontend/src/components/admin/ConfigPanel.vue`
- [x] T045 [US5] Add goal amount field in ConfigPanel
- [x] T046 [US5] Add preset amounts editor in ConfigPanel
- [x] T047 [US5] Add Menorah segments configuration in ConfigPanel
- [x] T048 [US5] Wire Socket event config:updated to refresh all displays
- [x] T049 [US5] Update AdminPanel to include ConfigPanel tab

**Checkpoint**: Config changes propagate to all displays in real-time

---

## Phase 8: Display Page Assembly

**Purpose**: Combine all visualizations on display page

- [x] T050 Create DisplayPage component in `frontend/src/pages/DisplayPage.vue`
- [x] T051 Compose Menorah + Counter + DonorPlates in DisplayPage
- [x] T052 Add /display route in `frontend/src/router.ts`
- [x] T053 Add fullscreen styling for display mode
- [x] T054 Handle reconnection logic (reload state on Socket reconnect)

**Checkpoint**: Display page shows all 3 animations synchronized

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final touches and edge cases

- [x] T055 [P] Add input validation on DonationForm (required fields, positive amounts)
- [x] T056 [P] Add error handling/display in admin panel
- [x] T057 [P] Add loading states during API calls
- [x] T058 Handle edge case: donations arriving simultaneously (debounce)
- [x] T059 Handle edge case: total exceeds goal (cap at 100%)
- [x] T060 [P] Add basic styling/CSS for admin panel
- [x] T061 Run quickstart.md validation (manual test)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS ALL USER STORIES
    ↓
┌───────────────────────────────────────────┐
│  US1 (P1) ─────→ US2 (P1) ────→ Display  │
│     │               │                     │
│     └──────────────┬┘                    │
│                    ↓                      │
│              US3 (P2) ────────→ Display  │
│              US4 (P2) ────────→ Display  │
│                    ↓                      │
│              US5 (P3) ────────→ Admin    │
└───────────────────────────────────────────┘
    ↓
Phase 8 (Display Assembly)
    ↓
Phase 9 (Polish)
```

### User Story Dependencies

- **US1 (Saisie)**: Depends on Foundational only - CAN START FIRST
- **US2 (Menorah)**: Depends on US1 (needs donation data) - START AFTER US1
- **US3 (Graphique)**: Depends on US1 (needs stats) - CAN PARALLEL WITH US2
- **US4 (Plaques)**: Depends on US1 (needs donations list) - CAN PARALLEL WITH US2/US3
- **US5 (Config)**: Independent of other stories - CAN START AFTER FOUNDATIONAL

### Within Each User Story

- Backend routes before frontend components
- Services before routes
- Composables before components that use them
- Core component before Socket wiring

---

## Parallel Opportunities

### Phase 2 (Foundational)

```bash
# These can run in parallel:
T009, T010, T011  # Model interfaces
T017, T018, T019  # Vue setup files
```

### Phase 3 (US1) + Phase 7 (US5)

```bash
# US1 and US5 can run in parallel after Foundational:
# Team A: T020-T027 (Donation CRUD)
# Team B: T042-T049 (Config CRUD)
```

### Phases 4, 5, 6 (Display Components)

```bash
# After US1 complete, these can run in parallel:
# Developer A: T028-T032 (Menorah)
# Developer B: T033-T036 (Counter)
# Developer C: T037-T041 (Plates)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (Donation CRUD)
4. Complete Phase 4: US2 (Menorah)
5. **STOP**: Test donation → Menorah illumination flow
6. Basic display page with Menorah only

### Incremental Delivery

1. **MVP**: US1 + US2 → Admin can add donations, Menorah lights up
2. **+Counter**: US3 → Add total counter to display
3. **+Plates**: US4 → Add donor plates to display
4. **+Config**: US5 → Admin can customize settings

### Estimated Task Counts

| Phase | Tasks | Parallel |
|-------|-------|----------|
| Setup | 7 | 4 |
| Foundational | 12 | 5 |
| US1 (Saisie) | 8 | 0 |
| US2 (Menorah) | 5 | 0 |
| US3 (Graphique) | 4 | 0 |
| US4 (Plaques) | 5 | 0 |
| US5 (Config) | 8 | 0 |
| Display Assembly | 5 | 0 |
| Polish | 7 | 4 |
| **TOTAL** | **61** | **13** |

---

## Notes

- [P] tasks = different files, no dependencies
- [USx] label maps task to specific user story
- Each user story independently testable after completion
- Commit after each task or logical group
- Stop at checkpoints to validate
- Constitution: KISS, YAGNI, Clean Code - keep it simple!
