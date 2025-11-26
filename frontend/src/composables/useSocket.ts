import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';

// Shared socket instance
let socket: Socket | null = null;
const isConnected = ref(false);

export function useSocket() {
  onMounted(() => {
    if (!socket) {
      socket = io(window.location.origin, {
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        isConnected.value = true;
        console.log('Socket connected');
      });

      socket.on('disconnect', () => {
        isConnected.value = false;
        console.log('Socket disconnected');
      });
    }
  });

  onUnmounted(() => {
    // Keep socket alive across components
  });

  // Subscribe to an event
  function on<T>(event: string, callback: (data: T) => void): void {
    socket?.on(event, callback);
  }

  // Unsubscribe from an event
  function off(event: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      socket?.off(event, callback);
    } else {
      socket?.off(event);
    }
  }

  // Emit an event
  function emit(event: string, data?: unknown): void {
    socket?.emit(event, data);
  }

  return {
    isConnected,
    on,
    off,
    emit
  };
}
