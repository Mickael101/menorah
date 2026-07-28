import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { Donation, DonationStats, Config } from '../models/types';
import { toPublicDonation } from '../models/donation';
import { eventService } from './event.service';

// Une soiree, une room. Le format est un contrat partage avec le client :
// il figure aussi en clair dans les tests, pour qu'un changement de format
// echoue au lieu de rendre tous les ecrans muets en silence.
export function eventRoom(eventId: number): string {
  return `event:${eventId}`;
}

const ROOM_PATTERN = /^event:\d+$/;

// CORS du socket. Une seule variable, CORS_ORIGIN, partagee avec le HTTP
// (app.ts) : liste d origines separees par des virgules. Non definie, le
// comportement reste EXACTEMENT celui d avant — les deux origines de
// developpement — pour ne rien regresser sur les ecrans en production, qui
// servent depuis la meme origine. `*` seul autorise toutes les origines.
const DEFAULT_SOCKET_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

export function socketCorsOrigin(): string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    return DEFAULT_SOCKET_CORS_ORIGINS;
  }
  const list = raw.split(',').map((origin) => origin.trim()).filter((origin) => origin.length > 0);
  if (list.length === 0) {
    return DEFAULT_SOCKET_CORS_ORIGINS;
  }
  return list.length === 1 && list[0] === '*' ? '*' : list;
}

// Abonne d'office un nouveau client a la soiree active.
//
// L'import est STATIQUE, et ce n'est pas anodin : une premiere version l'avait
// rendu paresseux par crainte de l'ordre de chargement — ce module est importe
// par index.ts avant initDatabase(). La crainte etait infondee (resolveActive
// n'est appele qu'a la CONNEXION d'un client, or server.listen() est la
// derniere instruction du demarrage) et le require ne se resolvait pas, si bien
// que le try/catch avalait l'echec et rendait l'auto-join totalement inerte
// sans que rien ne le signale. Un filet de securite silencieusement absent est
// pire que pas de filet.
//
// Le try/catch subsiste, mais reduit a son role : une base indisponible ne doit
// pas empecher un client de se connecter. Il logue en ERREUR, pas en
// avertissement, parce qu'il ne devrait jamais se declencher.
function autoJoinActiveEvent(socket: { join: (room: string) => void; id: string }): void {
  try {
    const { event } = eventService.resolveActive();
    if (!event) {
      return;
    }
    socket.join(eventRoom(event.id));
  } catch (error) {
    console.error('Auto-join impossible, le client devra rejoindre explicitement:', error);
  }
}

interface JoinAck {
  joined: boolean;
  room: string;
}

class SocketService {
  private io: SocketServer | null = null;

  // Initialize Socket.IO with HTTP server
  init(server: Server): void {
    this.io = new SocketServer(server, {
      cors: {
        origin: socketCorsOrigin(),
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // FILET DE COMPATIBILITE, et il n'est pas optionnel.
      // Faire passer les emissions de `io.emit` a `io.to(room)` orpheline d'un
      // coup TOUS les clients existants : aucun code frontend n'envoie `join`,
      // et le bundle deja servi depuis backend/public n'en contient pas une
      // occurrence. Sans ce defaut, l'ecran de la salle resterait muet toute la
      // soiree — sans erreur en console, sans log serveur, et avec une suite de
      // tests verte, puisque les tests joignent leurs clients explicitement.
      // Un client qui n'a pas dit QUELLE soiree il regarde est donc abonne a la
      // soiree ACTIVE : exactement la regle que suivent deja les URL sans slug.
      autoJoinActiveEvent(socket);

      socket.on('join', (data: { room?: unknown }, ack?: (result: JoinAck) => void) => {
        const room = typeof data?.room === 'string' ? data.room : '';

        // La room est la frontiere d'isolation. Recopier telle quelle une
        // chaine venue du client laisserait n'importe qui s'abonner a un canal
        // arbitraire. Restreindre l'espace de nommage ne prouve pas que ce
        // client a le droit de voir CETTE soiree — cette autorisation-la
        // viendra avec l'authentification a deux niveaux.
        if (!ROOM_PATTERN.test(room)) {
          console.warn(`Client ${socket.id} a demande une room invalide: ${room}`);
          ack?.({ joined: false, room });
          return;
        }

        // QUITTER AVANT DE REJOINDRE. Les rooms Socket.IO sont ADDITIVES :
        // `join` ajoute, il ne remplace jamais. Sans cette boucle, un client
        // auto-abonne a la soiree active qui rejoint ensuite explicitement une
        // autre soiree se retrouve dans les DEUX, et recoit les dons des deux —
        // c'est-a-dire la fuite exacte que ce cloisonnement existe pour
        // empecher, reintroduite par le filet de compatibilite lui-meme, et
        // pire que l'originale puisqu'elle ne frappe que les clients qui ont
        // rejoint apres coup : silencieuse et intermittente.
        // ROOM_PATTERN sert de discriminant : `socket.rooms` contient aussi la
        // room portant l'identifiant du socket, qu'il ne faut surtout pas
        // quitter, et le motif l'exclut sans cas particulier.
        for (const current of socket.rooms) {
          if (current !== room && ROOM_PATTERN.test(current)) {
            socket.leave(current);
          }
        }

        socket.join(room);
        console.log(`Client ${socket.id} joined room: ${room}`);
        // L'acquittement rend la jonction observable : sans lui, un client ne
        // peut pas savoir s'il est abonne, et un test ne peut que temporiser.
        ack?.({ joined: true, room });
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  async close(): Promise<void> {
    const io = this.io;
    this.io = null;
    if (io) {
      await io.close();
    }
  }

  // Emit new donation event.
  //
  // La room est recue par six pages PUBLIQUES : on n'y diffuse que la projection
  // publique (nom et montant, projetes sur le mur), jamais email, telephone ni
  // reference. Le meme depouillement protege deja la voie HTTP (toPublicDonation
  // dans routes/donations.ts) ; la voie temps reel etait restee ouverte.
  // L'administration, qui a besoin du payload complet, recharge par sa route
  // authentifiee GET /api/donations?full=1 dans le handler qui fait deja un
  // aller-retour.
  emitDonationNew(eventId: number, donation: Donation, stats: DonationStats): void {
    this.io?.to(eventRoom(eventId)).emit('donation:new', {
      type: 'donation:new',
      donation: toPublicDonation(donation),
      stats
    });
  }

  // Emit donation updated event. Meme projection publique que donation:new.
  emitDonationUpdated(eventId: number, donation: Donation, stats: DonationStats): void {
    this.io?.to(eventRoom(eventId)).emit('donation:updated', {
      type: 'donation:updated',
      donation: toPublicDonation(donation),
      stats
    });
  }

  // Emit donation deleted event
  emitDonationDeleted(eventId: number, donationId: number, stats: DonationStats): void {
    this.io?.to(eventRoom(eventId)).emit('donation:deleted', {
      type: 'donation:deleted',
      donationId,
      stats
    });
  }

  // Emit config updated event
  emitConfigUpdated(eventId: number, config: Config, stats: DonationStats): void {
    this.io?.to(eventRoom(eventId)).emit('config:updated', {
      type: 'config:updated',
      config,
      stats
    });
  }

  // Emit GIF trigger event to the display pages of one event (with optional audio)
  emitGifTrigger(eventId: number, gifUrl: string, audioUrl?: string): void {
    this.io?.to(eventRoom(eventId)).emit('gif:trigger', {
      type: 'gif:trigger',
      gifUrl,
      audioUrl
    });
  }

  // Coupe court a toute celebration en cours sur les ecrans de la soiree :
  // GIF, animation de plaque, file d'attente et audio. Bouton d'urgence de
  // l'operateur — un son trop long ou un GIF errone ne doit pas occuper la
  // salle jusqu'a son terme.
  emitCelebrationStop(eventId: number): void {
    this.io?.to(eventRoom(eventId)).emit('celebration:stop', {
      type: 'celebration:stop'
    });
  }
}

export const socketService = new SocketService();
