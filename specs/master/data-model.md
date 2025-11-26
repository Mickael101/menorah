# Data Model: Système de Visualisation des Dons

**Date**: 2025-01-26
**Database**: SQLite

## Entities

### Donation

Représente un don individuel.

```typescript
interface Donation {
  id: number;              // Auto-increment primary key
  firstName: string;       // Prénom du donateur (required)
  lastName: string;        // Nom du donateur (required)
  amount: number;          // Montant en centimes (ex: 18000 = 180€)
  reference?: string;      // Référence transaction (optional)
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}
```

**Validation Rules**:
- `firstName`: 1-100 caractères, trimmed
- `lastName`: 1-100 caractères, trimmed
- `amount`: entier positif > 0 (stocké en centimes)
- `reference`: 0-100 caractères (optional)

**SQL Schema**:
```sql
CREATE TABLE donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  reference TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_donations_created_at ON donations(created_at);
```

---

### Config

Configuration globale du système (singleton).

```typescript
interface Config {
  id: number;                    // Always 1 (singleton)
  goalAmount: number;            // Objectif total en centimes
  presetAmounts: number[];       // Montants prédéfinis [1800, 3600, 18000, 36000]
  menorahSegments: MenorahSegment[];
  updatedAt: string;
}

interface MenorahSegment {
  id: string;                    // ID du groupe SVG (ex: "segment-1")
  thresholdPercent: number;      // % du goal pour illuminer (ex: 10 = 10%)
  order: number;                 // Ordre d'affichage (1 = bas)
}
```

**Validation Rules**:
- `goalAmount`: entier positif > 0
- `presetAmounts`: array de 1-10 entiers positifs
- `menorahSegments`: array de 1-20 segments, IDs uniques

**SQL Schema**:
```sql
CREATE TABLE config (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  goal_amount INTEGER NOT NULL DEFAULT 10000000,  -- 100,000€
  preset_amounts TEXT NOT NULL DEFAULT '[1800,3600,18000,36000,100000]',
  menorah_segments TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default config
INSERT INTO config (id) VALUES (1);
```

---

### Computed Values (Not Stored)

Calculées à la volée depuis les donations:

```typescript
interface DonationStats {
  totalAmount: number;           // Somme de tous les dons
  donationCount: number;         // Nombre de dons
  percentComplete: number;       // (total / goal) * 100, max 100
  litSegments: string[];         // IDs des segments à illuminer
}
```

## Relationships

```
Config (1) ←──────── DonationStats (computed)
                            ↑
Donation (N) ───────────────┘
```

- `DonationStats` est calculé depuis toutes les `Donation`
- `Config.menorahSegments` détermine quels segments s'illuminent selon `percentComplete`

## State Transitions

### Donation Lifecycle

```
[New] ──create──→ [Active] ──delete──→ [Deleted]
                      │
                      └──update──→ [Active]
```

Pas de statut complexe. Un don existe ou n'existe pas.

### Menorah Segment States

```
[Unlit] ──threshold reached──→ [Lit]
   ↑                              │
   └──threshold dropped──────────┘
```

État calculé dynamiquement, pas stocké.

## API Data Shapes

### Create Donation Request

```typescript
interface CreateDonationRequest {
  firstName: string;
  lastName: string;
  amount: number;      // En centimes
  reference?: string;
}
```

### Donation Response (avec stats)

```typescript
interface DonationResponse {
  donation: Donation;
  stats: DonationStats;
}
```

### Real-Time Event Payload

```typescript
interface DonationEvent {
  type: 'donation:new' | 'donation:updated' | 'donation:deleted';
  donation: Donation;
  stats: DonationStats;
}
```

## Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| donations | `idx_donations_created_at` | Tri chronologique des plaques |

## Migration Strategy

Base SQLite créée au premier lancement. Pas de migrations complexes pour le MVP.

```typescript
// backend/src/db/init.ts
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS donations (...);
    CREATE TABLE IF NOT EXISTS config (...);
    INSERT OR IGNORE INTO config (id) VALUES (1);
  `);
}
```
