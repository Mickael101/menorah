import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { io as createClient, Socket } from 'socket.io-client';
import { socketService } from '../../src/services/socket.service';
import { Donation, DonationStats, Config, DEFAULT_DISPLAY_SETTINGS } from '../../src/models/types';

// Le critere d'acceptation du LOT 1 : « un don saisi sur la soiree A ne produit
// aucune animation sur l'ecran de la soiree B ».
//
// Ces tests montent un VRAI serveur Socket.IO et y branchent de VRAIS clients.
// Verifier qu'un mock a ete appele ne prouverait rien : l'isolation se joue
// dans la livraison, pas dans l'intention.

const SOIREE_A = 1;
const SOIREE_B = 2;

const EVENEMENTS = ['donation:new', 'donation:updated', 'donation:deleted', 'config:updated', 'gif:trigger'] as const;

const DON: Donation = {
  id: 42,
  firstName: 'Ada',
  lastName: 'Levi',
  email: null,
  phone: null,
  amount: 1000,
  reference: null,
  premiumWordId: null,
  createdAt: '2026-07-27 20:00:00',
  updatedAt: '2026-07-27 20:00:00'
};

const STATS: DonationStats = {
  totalAmount: 1000,
  donationCount: 1,
  percentComplete: 1,
  litSegments: []
};

const CONFIG: Config = {
  goalAmount: 100000,
  presetAmounts: [1800],
  menorahSegments: [],
  displaySettings: { ...DEFAULT_DISPLAY_SETTINGS }
};

const EMISSIONS: Array<{ nom: (typeof EVENEMENTS)[number]; declenche: (eventId: number) => void }> = [
  { nom: 'donation:new', declenche: (id) => socketService.emitDonationNew(id, DON, STATS) },
  { nom: 'donation:updated', declenche: (id) => socketService.emitDonationUpdated(id, DON, STATS) },
  { nom: 'donation:deleted', declenche: (id) => socketService.emitDonationDeleted(id, DON.id, STATS) },
  { nom: 'config:updated', declenche: (id) => socketService.emitConfigUpdated(id, CONFIG, STATS) },
  { nom: 'gif:trigger', declenche: (id) => socketService.emitGifTrigger(id, '/uploads/gifs/mazal.gif') }
];

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

function attendEvenement(client: Socket, nom: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`aucun ${nom} recu`)), 3000);
    client.once(nom, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// Barriere de synchronisation, pas une temporisation. Un aller-retour acquitte
// garantit que tout ce que le serveur avait deja envoye a ce client est arrive :
// si l'evenement n'est pas la maintenant, il n'arrivera jamais. La room demandee
// est volontairement invalide pour que la barriere ne modifie aucun abonnement.
async function videLaConduite(client: Socket): Promise<void> {
  await join(client, 'barriere-de-test');
}

describe('isolation temps reel entre soirees', () => {
  let httpServer: HttpServer;
  let clientA: Socket;
  let clientB: Socket;
  let clientSansRoom: Socket;
  let recuParB: string[] = [];
  let recuParSansRoom: string[] = [];

  beforeAll(async () => {
    httpServer = createServer();
    socketService.init(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const port = (httpServer.address() as AddressInfo).port;

    clientA = await connect(port);
    clientB = await connect(port);
    clientSansRoom = await connect(port);

    // Les rooms sont ecrites en clair : c'est le format que le client attend
    // (`event:<id>`), et le test doit echouer si l'implementation en change.
    await join(clientA, `event:${SOIREE_A}`);
    await join(clientB, `event:${SOIREE_B}`);

    for (const nom of EVENEMENTS) {
      clientB.on(nom, () => recuParB.push(nom));
      clientSansRoom.on(nom, () => recuParSansRoom.push(nom));
    }
  });

  afterAll(async () => {
    for (const client of [clientA, clientB, clientSansRoom]) {
      client.disconnect();
    }
    await socketService.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    recuParB = [];
    recuParSansRoom = [];
  });

  for (const emission of EMISSIONS) {
    it(`n envoie ${emission.nom} qu a la soiree concernee`, async () => {
      const attendu = attendEvenement(clientA, emission.nom);

      emission.declenche(SOIREE_A);

      const payload = await attendu;
      expect(payload).toMatchObject({ type: emission.nom });

      await videLaConduite(clientB);
      expect(recuParB).toEqual([]);
    });
  }

  it('n envoie rien a un client qui n a rejoint aucune soiree', async () => {
    const attendu = attendEvenement(clientA, 'donation:new');

    socketService.emitDonationNew(SOIREE_A, DON, STATS);

    await attendu;
    await videLaConduite(clientSansRoom);
    expect(recuParSansRoom).toEqual([]);
  });

  it('refuse une room qui n est pas une soiree', async () => {
    // La room porte l'isolation : recopier telle quelle une chaine venue du
    // client ouvrirait l'abonnement a n'importe quel canal interne.
    const ack = await join(clientSansRoom, 'admin');

    expect(ack.joined).toBe(false);
  });
});
