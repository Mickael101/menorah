import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { Donation, DonationStats, Config } from '../models/types';

class SocketService {
  private io: SocketServer | null = null;

  // Initialize Socket.IO with HTTP server
  init(server: Server): void {
    this.io = new SocketServer(server, {
      cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join', (data: { room: string }) => {
        socket.join(data.room);
        console.log(`Client ${socket.id} joined room: ${data.room}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  // Emit new donation event
  emitDonationNew(donation: Donation, stats: DonationStats): void {
    this.io?.emit('donation:new', {
      type: 'donation:new',
      donation,
      stats
    });
  }

  // Emit donation updated event
  emitDonationUpdated(donation: Donation, stats: DonationStats): void {
    this.io?.emit('donation:updated', {
      type: 'donation:updated',
      donation,
      stats
    });
  }

  // Emit donation deleted event
  emitDonationDeleted(donationId: number, stats: DonationStats): void {
    this.io?.emit('donation:deleted', {
      type: 'donation:deleted',
      donationId,
      stats
    });
  }

  // Emit config updated event
  emitConfigUpdated(config: Config, stats: DonationStats): void {
    this.io?.emit('config:updated', {
      type: 'config:updated',
      config,
      stats
    });
  }

  // Emit GIF trigger event to all display pages (with optional audio)
  emitGifTrigger(gifUrl: string, audioUrl?: string): void {
    this.io?.emit('gif:trigger', {
      type: 'gif:trigger',
      gifUrl,
      audioUrl
    });
  }
}

export const socketService = new SocketService();
