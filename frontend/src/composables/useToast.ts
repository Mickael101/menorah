import { ref } from 'vue';

// Retours utilisateur du panel admin.
//
// Avant, 4 des 5 boutons « Enregistrer » ne confirmaient rien : l'admin
// cliquait, rien ne bougeait, il recliquait ou concluait que ca ne marchait
// pas. Les echecs reseau de GifManager partaient meme en console.error, donc
// invisibles.

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DEFAULT_DURATION_MS = 3200;
const ERROR_DURATION_MS = 6000;

const toasts = ref<Toast[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();

let nextId = 1;

function dismiss(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts.value = toasts.value.filter(toast => toast.id !== id);
}

function push(kind: ToastKind, message: string): number {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, kind, message }];

  // Une erreur reste plus longtemps : on doit avoir le temps de la lire.
  const duration = kind === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS;
  timers.set(id, setTimeout(() => dismiss(id), duration));

  return id;
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (message: string): number => push('success', message),
    error: (message: string): number => push('error', message),
    info: (message: string): number => push('info', message)
  };
}
