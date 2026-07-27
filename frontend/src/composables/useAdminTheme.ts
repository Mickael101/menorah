import { ref } from 'vue';

// Bascule clair/sombre de l'ADMINISTRATION uniquement (2026-07-27, demande
// commanditaire). L'attribut est pose sur <html> mais seuls les tokens
// --shell-* / --field-* y reagissent : les ecrans publics (/display, /don)
// tirent leurs couleurs du theme de la soiree, pas de la coquille admin.
//
// Persistance locale par navigateur (localStorage) : le choix d'un operateur
// sur son poste n'a pas a suivre la soiree ni le compte.

export type AdminUiTheme = 'dark' | 'light';

const STORAGE_KEY = 'menorah_admin_ui_theme';

function readStored(): AdminUiTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

const current = ref<AdminUiTheme>(readStored());

function apply(theme: AdminUiTheme): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function useAdminTheme() {
  // A appeler au montage de chaque page d'administration (panneau ET ecran
  // de connexion) : la preference doit s'appliquer avant l'authentification.
  function init(): void {
    apply(current.value);
  }

  function toggle(): void {
    current.value = current.value === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEY, current.value);
    } catch {
      // stockage indisponible : la bascule vaut pour la session en cours
    }
    apply(current.value);
  }

  return { theme: current, init, toggle };
}
