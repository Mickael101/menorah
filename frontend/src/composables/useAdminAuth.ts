import { ref } from 'vue';
import { currentEventScope } from './useEventContext';

// Signal de re-authentification en cours de session. `adminFetch` le leve quand
// un jeton REELLEMENT envoye est rejete (401) : le code admin a ete invalide
// alors que le panneau etait deja ouvert (typiquement l'organisateur l'a
// regenere). Le gate d'entree (AdminEntry) surveille ce signal pour re-presenter
// l'ecran de connexion AdminLogin, puis le baisse. `setAdminToken` le baisse
// aussi des qu'un nouveau jeton est pose, ce qui re-arme le signal pour une
// expiration ulterieure. Sans lui, chaque action admin echouait en silence une
// fois le jeton perime, sans aucun chemin de retour vers la connexion.
export const authExpired = ref(false);

// Stockage du jeton PAR SOIREE. Une cle unique faisait qu'une connexion a la
// soiree B ecrasait celle de la soiree A. On garde la cle historique comme
// repli « organisateur / soiree active » (le jeton organisateur vaut pour
// toutes les soirees), et on prefixe une cle par identifiant de soiree pour les
// codes d'admin de soiree.
const LEGACY_KEY = 'menorah_admin_token';
const EVENT_KEY_PREFIX = 'menorah_admin_token:';

function eventKey(eventId: number): string {
  return `${EVENT_KEY_PREFIX}${eventId}`;
}

// Lit le jeton applicable a une soiree : d'abord la cle propre a la soiree,
// puis la cle historique (jeton organisateur, valable partout). Sans argument,
// seule la cle historique est consultee (routes heritees / soiree active).
export function getAdminToken(eventId?: number | null): string {
  if (eventId != null) {
    const scoped = localStorage.getItem(eventKey(eventId));
    if (scoped) {
      return scoped;
    }
  }
  return localStorage.getItem(LEGACY_KEY) || '';
}

// Ecrit le jeton. Avec un eventId, il est range sous la cle de cette soiree
// (une connexion a une autre soiree n'ecrase plus rien) ; sans eventId, sous la
// cle historique (jeton organisateur ou soiree active).
export function setAdminToken(token: string, eventId?: number | null): void {
  const clean = token.trim();
  if (eventId != null) {
    localStorage.setItem(eventKey(eventId), clean);
  } else {
    localStorage.setItem(LEGACY_KEY, clean);
  }
  // Un nouveau jeton pose : la session n'est plus « expiree ». Baisser le signal
  // ici le re-arme pour une eventuelle expiration ulterieure.
  authExpired.value = false;
}

export function clearAdminToken(eventId?: number | null): void {
  if (eventId != null) {
    localStorage.removeItem(eventKey(eventId));
  } else {
    localStorage.removeItem(LEGACY_KEY);
  }
}

export function adminHeaders(eventId?: number | null): Record<string, string> {
  const token = getAdminToken(eventId);
  return token ? { 'x-admin-token': token } : {};
}

// Reecrit une URL heritee vers son equivalent prefixe quand une soiree est en
// portee. C'est le point unique qui event-scope TOUT l'admin — la liste et les
// mutations de dons, la config, l'export CSV, les envois de GIF/SVG — sans
// toucher chaque composant appelant (dont DisplaySettingsPanel, propriete d'un
// autre front). Sans portee (soiree active), l'URL est laissee telle quelle :
// zero changement de comportement sur le flux herite.
//
// Le prefixe `donations` couvre aussi ses sous-chemins : le lookahead accepte
// `/`, donc `/api/donations/premium-words` est reecrit en
// `/api/events/:id/donations/premium-words` (route scopee montee sous les deux
// prefixes). fetchPremiumWords passe desormais par scopedApiUrl pour frapper la
// soiree administree, comme la liste des dons et la config.
const LEGACY_RESOURCE = /\/api\/(donations|config|gifs|stats)(?=$|[/?])/;

export function scopedApiUrl(url: string, eventId: number | null): string {
  if (eventId == null) {
    return url;
  }
  if (url.includes('/api/events/')) {
    return url;
  }
  return url.replace(LEGACY_RESOURCE, `/api/events/${eventId}/$1`);
}

// Wrapper fetch pour les endpoints admin : injecte le jeton de la soiree en
// portee et cible la route prefixee correspondante. La saisie du code passe par
// l'ecran de connexion AdminLogin (plus de window.prompt). Recuperation EN COURS
// de session : si un jeton qu'on a reellement envoye revient 401 (typiquement
// l'organisateur a regenere le code alors que le panneau etait ouvert), on leve
// `authExpired` pour que le gate (AdminEntry) re-presente l'ecran de connexion.
// La reponse est tout de meme remontee a l'appelant, qui gere deja l'echec ; on
// ne rejoue pas ici (le nouveau code repasse par AdminLogin, source unique de
// verite).
export interface AdminFetchIntent {
  // Un 401 est une REPONSE ATTENDUE ici, pas une expiration. C'est le cas des
  // sondes d'autorite : GET /api/events est reserve a l'organisateur, donc un
  // admin de soiree au code parfaitement valide y recoit 401 par conception
  // (AdminEntry.probeOrganizer, ThemeGallery.probeOrganizer). Sans ce drapeau,
  // ces sondes leveraient `authExpired` et ejecteraient vers l'ecran de
  // connexion un admin dont la session est saine.
  expectAuthFailure?: boolean;
}

export async function adminFetch(
  url: string,
  options: RequestInit = {},
  intent: AdminFetchIntent = {}
): Promise<Response> {
  const scope = currentEventScope();
  const target = scopedApiUrl(url, scope);
  const hadToken = Boolean(getAdminToken(scope));
  const response = await fetch(target, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      ...adminHeaders(scope)
    }
  });
  // Un 401 sur une requete SANS jeton (gate initial) est normal : ne pas lever
  // le signal, sinon on brouille le premier ecran de connexion. On ne le leve
  // que si le jeton envoye a ete rejete sur une route ou il aurait du valoir —
  // la vraie expiration en cours de route.
  if (hadToken && response.status === 401 && !intent.expectAuthFailure) {
    authExpired.value = true;
  }
  return response;
}
