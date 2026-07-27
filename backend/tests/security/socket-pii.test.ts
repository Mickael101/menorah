import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { io as createClient, Socket } from 'socket.io-client';
import { socketService } from '../../src/services/socket.service';
import { Donation, DonationStats } from '../../src/models/types';

// La fuite PII par le socket : emitDonationNew et emitDonationUpdated
// diffusaient l'objet Donation COMPLET vers la room, recue par six pages
// publiques (DisplayPage, DisplayPage8, DisplayHiddenPage, MenorahDisplay,
// DonorPlatesGrid, MenorahAscension). N'importe qui ouvrant l'ecran de la salle
// recevait donc en direct email, telephone et reference de chaque donateur.
//
// Ce test monte un VRAI serveur Socket.IO et y branche un VRAI client, comme
// socket-isolation.test.ts : verifier qu'un mock a ete appele ne prouverait
// rien, la fuite se joue dans la LIVRAISON. Le don porte des coordonnees
// reelles pour que le test soit ROUGE tant que le payload complet passe.

const SOIREE = 1;

const DON_AVEC_PII: Donation = {
  id: 7,
  firstName: 'Dana',
  lastName: 'Cohen',
  email: 'fuite-socket@example.com',
  phone: '0521234567',
  amount: 500000,
  reference: 'REF-SOCKET-SECRETE',
  premiumWordId: null,
  createdAt: '2026-07-27 21:00:00',
  updatedAt: '2026-07-27 21:00:00'
};

const STATS: DonationStats = {
  totalAmount: 500000,
  donationCount: 1,
  percentComplete: 5,
  litSegments: []
};

interface JoinAck {
  joined: boolean;
  room: string;
}

function connect(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const client = createClient(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function join(client: Socket, room: string): Promise<JoinAck> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`join non acquitte pour ${room}`)), 3000);
    client.emit('join', { room }, (ack: JoinAck) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function attendEvenement(client: Socket, nom: string): Promise<{ donation: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`aucun ${nom} recu`)), 3000);
    client.once(nom, (payload: { donation: Record<string, unknown> }) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const CAS: Array<{ nom: 'donation:new' | 'donation:updated'; declenche: () => void }> = [
  { nom: 'donation:new', declenche: () => socketService.emitDonationNew(SOIREE, DON_AVEC_PII, STATS) },
  { nom: 'donation:updated', declenche: () => socketService.emitDonationUpdated(SOIREE, DON_AVEC_PII, STATS) }
];

describe('la PII ne franchit pas le socket', () => {
  let httpServer: HttpServer;
  let client: Socket;

  beforeAll(async () => {
    httpServer = createServer();
    socketService.init(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const port = (httpServer.address() as AddressInfo).port;

    client = await connect(port);
    await join(client, `event:${SOIREE}`);
  });

  afterAll(async () => {
    client.disconnect();
    await socketService.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  for (const cas of CAS) {
    it(`${cas.nom} ne transporte ni email, ni telephone, ni reference`, async () => {
      const attendu = attendEvenement(client, cas.nom);

      cas.declenche();

      const payload = await attendu;

      expect(payload.donation).not.toHaveProperty('email');
      expect(payload.donation).not.toHaveProperty('phone');
      expect(payload.donation).not.toHaveProperty('reference');

      // Le payload entier, pas seulement les champs connus : aucune trace des
      // valeurs sensibles, meme nichee ailleurs.
      const brut = JSON.stringify(payload);
      expect(brut).not.toContain('fuite-socket@example.com');
      expect(brut).not.toContain('0521234567');
      expect(brut).not.toContain('REF-SOCKET-SECRETE');

      // Ce dont l'ecran public a besoin reste present.
      expect(payload.donation).toMatchObject({
        id: DON_AVEC_PII.id,
        firstName: DON_AVEC_PII.firstName,
        lastName: DON_AVEC_PII.lastName,
        amount: DON_AVEC_PII.amount
      });
    });
  }
});
