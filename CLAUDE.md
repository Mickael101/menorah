# OHEL YEOCHOUA Development Guidelines

Auto-generated from feature plans. Last updated: 2025-01-26

## Active Technologies

- **Language**: TypeScript 5.x
- **Frontend**: Vue.js 3 (Composition API)
- **Backend**: Express.js
- **Real-time**: Socket.IO
- **Database**: SQLite (better-sqlite3)
- **Build**: Vite (frontend), tsc (backend)

## Project Structure

```text
backend/
├── src/
│   ├── models/          # Donation, Config types
│   ├── services/        # DonationService, SocketService
│   ├── routes/          # API REST endpoints
│   └── index.ts         # Entry point + Socket.IO setup
├── db/
│   └── donations.db     # SQLite database
└── package.json

frontend/
├── src/
│   ├── components/
│   │   ├── admin/       # Panel admin (DonationForm, ConfigPanel)
│   │   └── display/     # Visualisations (Menorah, Chart, DonorPlates)
│   ├── composables/     # useSocket, useDonations
│   ├── App.vue
│   └── main.ts
├── public/
│   └── assets/
│       └── menorah.svg  # Fichier SVG segmenté
└── package.json
```

## Commands

```bash
# Backend
cd backend && npm run dev      # Development with hot reload
cd backend && npm run build    # Compile TypeScript
cd backend && npm start        # Production

# Frontend
cd frontend && npm run dev     # Vite dev server
cd frontend && npm run build   # Production build
```

## Code Style

### TypeScript
- Strict mode enabled
- Explicit return types on functions
- Prefer `const` over `let`
- Use interfaces for data shapes

### Vue.js
- Composition API with `<script setup>`
- Composables for shared logic (`use*` naming)
- Props with type definitions

### Naming
- camelCase for variables and functions
- PascalCase for components and types
- kebab-case for file names

## Constitution Principles

1. **KISS**: Simplest solution that works
2. **YAGNI**: Only build what's needed now
3. **Clean Code**: Readable, self-documenting

## Recent Changes

### master (2025-01-26)
- Initial project setup
- Donation visualization system with Menorah, Chart, Donor Plates
- Admin panel for donation entry and configuration
- Real-time updates via Socket.IO

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
