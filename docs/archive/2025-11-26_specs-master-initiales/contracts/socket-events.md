# Socket.IO Events Contract

**Date**: 2025-01-26
**Protocol**: Socket.IO v4

## Connection

```typescript
// Client connection
const socket = io('http://localhost:3000');

// Join room (optional, for targeted updates)
socket.emit('join', { room: 'display' }); // or 'admin'
```

## Server → Client Events

### `donation:new`

Émis quand un nouveau don est créé.

```typescript
interface DonationNewEvent {
  type: 'donation:new';
  donation: {
    id: number;
    firstName: string;
    lastName: string;
    amount: number;        // centimes
    reference?: string;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    totalAmount: number;   // centimes
    donationCount: number;
    percentComplete: number;
    litSegments: string[];
  };
}
```

**Usage côté client**:
```typescript
socket.on('donation:new', (event: DonationNewEvent) => {
  // 1. Ajouter le don à la liste des plaques
  donations.value.push(event.donation);

  // 2. Mettre à jour le compteur/graphique
  totalAmount.value = event.stats.totalAmount;

  // 3. Mettre à jour la Menorah
  litSegments.value = event.stats.litSegments;
});
```

---

### `donation:updated`

Émis quand un don est modifié.

```typescript
interface DonationUpdatedEvent {
  type: 'donation:updated';
  donation: Donation;
  stats: DonationStats;
}
```

**Usage côté client**:
```typescript
socket.on('donation:updated', (event: DonationUpdatedEvent) => {
  // Remplacer le don dans la liste
  const index = donations.value.findIndex(d => d.id === event.donation.id);
  if (index !== -1) {
    donations.value[index] = event.donation;
  }

  // Recalculer les visualisations
  updateVisualizations(event.stats);
});
```

---

### `donation:deleted`

Émis quand un don est supprimé.

```typescript
interface DonationDeletedEvent {
  type: 'donation:deleted';
  donationId: number;
  stats: DonationStats;
}
```

**Usage côté client**:
```typescript
socket.on('donation:deleted', (event: DonationDeletedEvent) => {
  // Retirer le don de la liste
  donations.value = donations.value.filter(d => d.id !== event.donationId);

  // Recalculer les visualisations (menorah peut "s'éteindre")
  updateVisualizations(event.stats);
});
```

---

### `config:updated`

Émis quand la configuration change.

```typescript
interface ConfigUpdatedEvent {
  type: 'config:updated';
  config: {
    goalAmount: number;
    presetAmounts: number[];
    menorahSegments: MenorahSegment[];
  };
  stats: DonationStats;  // Recalculé avec le nouveau goal
}
```

**Usage côté client**:
```typescript
socket.on('config:updated', (event: ConfigUpdatedEvent) => {
  // Mettre à jour la config locale
  config.value = event.config;

  // Recalculer les visualisations avec le nouveau goal
  updateVisualizations(event.stats);
});
```

---

## Client → Server Events

### `join`

Rejoindre une room spécifique (optionnel).

```typescript
socket.emit('join', { room: 'display' | 'admin' });
```

**Note**: Par défaut, tous les clients reçoivent tous les événements.
Les rooms permettent de cibler des mises à jour spécifiques si nécessaire.

---

## Error Handling

### `error`

Émis en cas d'erreur côté serveur.

```typescript
interface SocketError {
  type: 'error';
  message: string;
}
```

---

## Reconnection

Socket.IO gère automatiquement la reconnexion. Après reconnexion:

```typescript
socket.on('connect', () => {
  // Recharger l'état complet depuis l'API REST
  fetchDonations();
  fetchConfig();
});
```

---

## Sequence Diagrams

### Nouveau don

```
Admin Panel          Backend            Display
    |                   |                  |
    |--POST /donations->|                  |
    |<--201 + stats-----|                  |
    |                   |--donation:new--->|
    |                   |                  |--animate-->
```

### Modification don

```
Admin Panel          Backend            Display
    |                   |                  |
    |--PUT /donations/1>|                  |
    |<--200 + stats-----|                  |
    |                   |-donation:updated>|
    |                   |                  |--recalculate-->
```
