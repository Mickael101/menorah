import { currentEventScope } from './useEventContext';

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
// `premium-words` reste hors soiree (contrat) : il est appele par `fetch`, pas
// par `adminFetch`, donc jamais reecrit ici.
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
// portee et cible la route prefixee correspondante. Le remplacement du
// window.prompt par un vrai ecran de connexion se fait en amont (l'ecran pose
// le jeton avant que la page admin ne s'affiche) : un 401/403 est donc
// simplement remonte a l'appelant, qui laisse l'ecran de connexion le traiter.
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const scope = currentEventScope();
  const target = scopedApiUrl(url, scope);
  return fetch(target, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      ...adminHeaders(scope)
    }
  });
}
