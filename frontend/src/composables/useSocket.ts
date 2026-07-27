import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useEventContext } from './useEventContext';

// Shared socket instance
let socket: Socket | null = null;
const isConnected = ref(false);

// Room de soiree que la page courante veut surveiller, resolue en `event:<id>`
// concret (soiree nommee OU soiree active). Memorisee au niveau module pour
// etre re-emise a chaque (re)connexion : le backend abonne d'office un nouveau
// socket a la soiree ACTIVE, et son handler `join` quitte les autres rooms
// `event:*` avant de rejoindre celle demandee. Sans re-emission apres une
// reconnexion, l'ecran retomberait silencieusement sur la soiree active.
let desiredRoom: string | null = null;

type SocketCallback = (...args: any[]) => void;

function ensureSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      isConnected.value = true;
      console.log('Socket connected');
      if (desiredRoom) {
        socket?.emit('join', { room: desiredRoom });
      }
    });

    socket.on('disconnect', () => {
      isConnected.value = false;
      console.log('Socket disconnected');
    });
  }

  return socket;
}

export function useSocket() {
  const localListeners: Array<{ event: string; callback: SocketCallback }> = [];

  onMounted(() => {
    const currentSocket = ensureSocket();

    for (const listener of localListeners) {
      if (!currentSocket.listeners(listener.event).includes(listener.callback)) {
        currentSocket.on(listener.event, listener.callback);
      }
    }
  });

  onUnmounted(() => {
    for (const listener of localListeners) {
      socket?.off(listener.event, listener.callback);
    }
    localListeners.length = 0;
  });

  // Subscribe to an event
  function on<T>(event: string, callback: (data: T) => void): void {
    const socketCallback = callback as SocketCallback;
    localListeners.push({ event, callback: socketCallback });
    socket?.on(event, socketCallback);
  }

  // Unsubscribe from an event
  function off(event: string, callback?: SocketCallback): void {
    for (let index = localListeners.length - 1; index >= 0; index -= 1) {
      const listener = localListeners[index];
      if (listener.event === event && (!callback || listener.callback === callback)) {
        socket?.off(listener.event, listener.callback);
        localListeners.splice(index, 1);
      }
    }
  }

  // Emit an event
  function emit(event: string, data?: unknown): void {
    socket?.emit(event, data);
  }

  // Rejoint la room temps reel de la soiree a surveiller. L'argument est la
  // PORTEE (currentEventScope) : un id pour une soiree nommee, `null` pour une
  // route heritee. `null` ne veut PAS dire « ne rien faire » : la room a
  // surveiller est alors celle de la soiree ACTIVE, qu'on resout via
  // useEventContext. On ne peut pas early-return, car le socket est un singleton
  // de module qui survit aux navigations SPA et le backend n'auto-abonne qu'a la
  // CONNEXION : un socket deplace dans event:A par un ecran /e/:slug y resterait
  // apres un retour sur /admin (soiree active B), et les dons de B n'arriveraient
  // plus. En (re)joignant la room active, le handler `join` backend quitte event:A
  // avant de rejoindre event:B.
  function join(eventId: number | null): void {
    const targetId = eventId ?? useEventContext().eventId.value;
    if (targetId == null) {
      // Aucune soiree resolue (pas de soiree active, ou contexte pas encore
      // pret) : rien a rejoindre. On efface la room desiree pour ne pas forcer
      // une room perimee aux prochaines (re)connexions.
      desiredRoom = null;
      return;
    }
    const room = `event:${targetId}`;
    desiredRoom = room;
    const currentSocket = ensureSocket();
    if (currentSocket.connected) {
      currentSocket.emit('join', { room });
    }
    // Sinon, le handler `connect` de ensureSocket emettra le join des l'ouverture.
  }

  return {
    isConnected,
    on,
    off,
    emit,
    join
  };
}
