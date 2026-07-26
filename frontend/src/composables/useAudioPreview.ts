import { ref } from 'vue';

// Lecteur de previsualisation unique pour tout le panel admin.
//
// Avant, chaque bouton de lecture faisait `new Audio(url).play()` sur une
// variable locale jetee aussitot (GifManager et DisplaySettingsPanel avaient
// chacun leur copie). Aucune reference ne survivait pour appeler pause() :
// les lectures s'empilaient, devenaient inarretables, et survivaient au
// changement d'onglet.
//
// Ici l'instance vit au niveau du module : un seul son joue a la fois, et
// re-cliquer sur le meme bouton arrete la lecture.

const playingUrl = ref<string | null>(null);
const lastError = ref<string | null>(null);

let current: HTMLAudioElement | null = null;

function release(): void {
  if (!current) return;
  current.onended = null;
  current.onerror = null;
  current.pause();
  current.currentTime = 0;
  current = null;
}

export function useAudioPreview() {
  function stop(): void {
    release();
    playingUrl.value = null;
  }

  function isPlaying(url: string | null | undefined): boolean {
    return Boolean(url) && playingUrl.value === url;
  }

  // Re-cliquer sur le son en cours l'arrete.
  // Cliquer sur un autre son coupe le precedent : jamais deux a la fois.
  async function toggle(url: string): Promise<void> {
    lastError.value = null;

    if (playingUrl.value === url) {
      stop();
      return;
    }

    release();

    const audio = new Audio(url);
    current = audio;
    playingUrl.value = url;

    audio.onended = (): void => {
      if (current === audio) stop();
    };

    audio.onerror = (): void => {
      if (current === audio) {
        lastError.value = 'unreadable';
        stop();
      }
    };

    try {
      await audio.play();
    } catch (e) {
      // Autoplay bloque par le navigateur (NotAllowedError) : les anciennes
      // versions admin avalaient cette erreur sans rien afficher.
      if (current === audio) {
        lastError.value = e instanceof Error ? e.message : 'unreadable';
        stop();
      }
    }
  }

  return { playingUrl, lastError, toggle, stop, isPlaying };
}
