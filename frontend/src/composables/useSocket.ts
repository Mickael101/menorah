import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';

// Shared socket instance
let socket: Socket | null = null;
const isConnected = ref(false);

// Room de soiree explicitement demandee par la page courante. Memorisee au
// niveau module pour etre re-emise a chaque (re)connexion : le backend abonne
// d'office un nouveau socket a la soiree ACTIVE, et son handler `join` quitte la
// room par defaut avant de rejoindre celle demandee. Sans re-emission apres une
// reconnexion, un ecran de soiree nommee retomberait silencieusement sur la
// soiree active.
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

  // Rejoint la room d'une soiree nommee. `null` revient a la soiree active :
  // on efface la room demandee (les prochaines (re)connexions ne forceront plus
  // de room), ce qui laisse jouer l'auto-abonnement du backend a la soiree
  // active. Une page heritee (sans slug) n'appelle jamais join : comportement
  // inchange.
  function join(eventId: number | null): void {
    if (eventId == null) {
      desiredRoom = null;
      return;
    }
    const room = `event:${eventId}`;
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
