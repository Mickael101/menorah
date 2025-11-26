<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useDonations } from '../../composables/useDonations';

const { config, fetchConfig, updateConfig, formatAmount, isLoading, error } = useDonations();

// Local form state
const goalAmount = ref(0);
const presetAmounts = ref<number[]>([]);
const newPreset = ref('');
const segments = ref<{ id: string; thresholdPercent: number; order: number }[]>([]);
const newSegmentId = ref('');
const newSegmentThreshold = ref(0);

// Load config on mount
onMounted(async () => {
  await fetchConfig();
  syncFormWithConfig();
});

// Sync form with config changes
watch(() => config.value, () => {
  syncFormWithConfig();
}, { deep: true });

function syncFormWithConfig(): void {
  goalAmount.value = config.value.goalAmount / 100; // Convert cents to euros
  presetAmounts.value = [...config.value.presetAmounts];
  segments.value = [...config.value.menorahSegments];
}

// Save goal amount
async function saveGoalAmount(): Promise<void> {
  await updateConfig({
    goalAmount: Math.round(goalAmount.value * 100) // Convert euros to cents
  });
}

// Add preset amount
function addPreset(): void {
  const amount = parseFloat(newPreset.value);
  if (!isNaN(amount) && amount > 0) {
    const cents = Math.round(amount * 100);
    if (!presetAmounts.value.includes(cents)) {
      presetAmounts.value.push(cents);
      presetAmounts.value.sort((a, b) => a - b);
      newPreset.value = '';
    }
  }
}

// Remove preset amount
function removePreset(amount: number): void {
  presetAmounts.value = presetAmounts.value.filter(a => a !== amount);
}

// Save preset amounts
async function savePresets(): Promise<void> {
  await updateConfig({ presetAmounts: presetAmounts.value });
}

// Add segment
function addSegment(): void {
  if (!newSegmentId.value || newSegmentThreshold.value < 0 || newSegmentThreshold.value > 100) {
    return;
  }

  const nextOrder = segments.value.length > 0
    ? Math.max(...segments.value.map(s => s.order)) + 1
    : 1;

  segments.value.push({
    id: newSegmentId.value,
    thresholdPercent: newSegmentThreshold.value,
    order: nextOrder
  });

  newSegmentId.value = '';
  newSegmentThreshold.value = 0;
}

// Remove segment
function removeSegment(id: string): void {
  segments.value = segments.value.filter(s => s.id !== id);
}

// Save segments
async function saveSegments(): Promise<void> {
  await updateConfig({ menorahSegments: segments.value });
}
</script>

<template>
  <div class="config-panel">
    <h3>Configuration</h3>

    <p v-if="error" class="error">{{ error }}</p>

    <!-- Goal Amount -->
    <div class="config-section">
      <h4>Objectif de collecte</h4>
      <div class="input-group">
        <input
          type="number"
          v-model="goalAmount"
          min="1"
          step="100"
          placeholder="Objectif en euros"
        />
        <span class="suffix">€</span>
        <button @click="saveGoalAmount" :disabled="isLoading">
          {{ isLoading ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
      <p class="hint">Objectif actuel: {{ formatAmount(config.goalAmount) }}</p>
    </div>

    <!-- Preset Amounts -->
    <div class="config-section">
      <h4>Montants prédéfinis</h4>
      <div class="preset-list">
        <span
          v-for="amount in presetAmounts"
          :key="amount"
          class="preset-tag"
        >
          {{ formatAmount(amount) }}
          <button @click="removePreset(amount)" class="remove-btn">×</button>
        </span>
      </div>
      <div class="input-group">
        <input
          type="number"
          v-model="newPreset"
          min="0.01"
          step="0.01"
          placeholder="Nouveau montant (€)"
          @keyup.enter="addPreset"
        />
        <button @click="addPreset">Ajouter</button>
      </div>
      <button @click="savePresets" :disabled="isLoading" class="save-btn">
        Enregistrer les montants
      </button>
    </div>

    <!-- Menorah Segments -->
    <div class="config-section">
      <h4>Segments de la Menorah</h4>
      <p class="hint">
        Définissez les segments SVG et leur seuil d'illumination (% de l'objectif).
      </p>

      <table v-if="segments.length > 0" class="segments-table">
        <thead>
          <tr>
            <th>ID Segment</th>
            <th>Seuil (%)</th>
            <th>Ordre</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="segment in segments" :key="segment.id">
            <td>{{ segment.id }}</td>
            <td>{{ segment.thresholdPercent }}%</td>
            <td>{{ segment.order }}</td>
            <td>
              <button @click="removeSegment(segment.id)" class="remove-btn">×</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="segment-form">
        <input
          type="text"
          v-model="newSegmentId"
          placeholder="ID (ex: segment-1)"
        />
        <input
          type="number"
          v-model="newSegmentThreshold"
          min="0"
          max="100"
          placeholder="Seuil %"
        />
        <button @click="addSegment">Ajouter</button>
      </div>
      <button @click="saveSegments" :disabled="isLoading" class="save-btn">
        Enregistrer les segments
      </button>
    </div>
  </div>
</template>

<style scoped>
.config-panel {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin: 0 0 20px;
  color: #333;
}

h4 {
  margin: 0 0 12px;
  color: #555;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #eee;
}

.config-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.input-group input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-group .suffix {
  color: #666;
}

.input-group button,
.save-btn {
  padding: 8px 16px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.input-group button:hover:not(:disabled),
.save-btn:hover:not(:disabled) {
  background: #1557b0;
}

.input-group button:disabled,
.save-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.save-btn {
  margin-top: 12px;
  width: 100%;
}

.hint {
  font-size: 12px;
  color: #666;
  margin: 4px 0;
}

.error {
  color: #d93025;
  margin-bottom: 16px;
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preset-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #e8f0fe;
  color: #1a73e8;
  border-radius: 16px;
  font-size: 13px;
}

.remove-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}

.remove-btn:hover {
  color: #d93025;
}

.segments-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 13px;
}

.segments-table th,
.segments-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.segments-table th {
  color: #666;
  font-weight: 500;
}

.segment-form {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.segment-form input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.segment-form input:first-child {
  flex: 2;
}

.segment-form input:nth-child(2) {
  flex: 1;
  width: 80px;
}

.segment-form button {
  padding: 8px 12px;
  background: #f1f3f4;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.segment-form button:hover {
  background: #e8eaed;
}
</style>
