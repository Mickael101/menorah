import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { io as createClient, Socket } from 'socket.io-client';
import { initTestDatabase } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { createApp } from '../../src/app';
import { socketService } from '../../src/services/socket.service';

// LA COUTURE ENTRE LA ROUTE ET L'ECRAN.
//
// Le test d'isolation voisin monte le service socket seul et joint ses clients
// explicitement : il prouve que le SERVEUR honore son contrat. Il ne prouve pas
// que quelqu'un le respecte en face, ni que la route passe bien a l'emission la
// soiree qu'elle vient de resoudre.
//
// Ces deux trous se sont averes couteux : faire passer les emissions de
// `io.emit` a `io.to(room)` a orpheline d'un coup tous les clients deja
// deployes, qui n'envoient aucun `join` — l'ecran de la salle serait reste muet
// toute la soiree, sans erreur, sans log, et avec une suite verte.
//
// Ce fichier traverse donc la chaine ENTIERE : vraie base, vraie application
// Express, vrai serveur Socket.IO, vrais clients construits comme le frontend,
// et un vrai POST sur la route heritee.

interface JoinAck {
  joined: boolean;
  room: string;
}

// Un client construit exactement comme le frontend : il se connecte, il ecoute,
// et il n'envoie JAMAIS `join`.
function connectLikeFrontend(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const client = createClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });
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

function attend(client: Socket, nom: string, delai = 3000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`aucun ${nom} recu en ${delai} ms`)), delai);
    client.once(nom, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// Barriere de synchronisation, pas une temporisation : un aller-retour acquitte
// sur la socket du client garantit que tout ce que le serveur lui avait envoye
// est arrive. « Rien recu » signifie donc « ne recevra jamais ».
async function videLaConduite(client: Socket): Promise<void> {
  await join(client, 'barriere-de-test');
}

describe('couture route -> ecran', () => {
  let httpServer: HttpServer;
  let port: number;
  let autreSoiree: number;

  beforeAll(async () => {
    await initTestDatabase();
    const app = createApp();
    httpServer = createServer(app);
    socketService.init(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    port = (httpServer.address() as AddressInfo).port;

    autreSoiree = insertEvent({ slug: 'autre-soiree', status: 'draft' });
  });

  afterAll(async () => {
    await socketService.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('un ecran deja deploye, qui ne rejoint aucune room, recoit toujours les dons', async () => {
    const ecran = await connectLikeFrontend(port);
    const recu = attend(ecran, 'donation:new');

    const reponse = await request(httpServer)
      .post('/api/donations')
      .send({ firstName: 'Ada', lastName: 'Levi', amount: 1800 });
    expect(reponse.status).toBe(201);

    const payload = (await recu) as { donation: { firstName: string } };
    expect(payload.donation.firstName).toBe('Ada');

    ecran.disconnect();
  });

  it('un ecran abonne a une AUTRE soiree ne recoit pas ce don', async () => {
    const ecranAutre = await connectLikeFrontend(port);
    // La jonction explicite doit REMPLACER l'abonnement d'office, pas s'y
    // ajouter : les rooms Socket.IO sont additives, et sans la sortie de room ce
    // client recevrait les deux soirees — la fuite meme que le cloisonnement
    // existe pour empecher.
    const ack = await join(ecranAutre, `event:${autreSoiree}`);
    expect(ack.joined).toBe(true);

    const recu: string[] = [];
    ecranAutre.on('donation:new', () => recu.push('donation:new'));

    const reponse = await request(httpServer)
      .post('/api/donations')
      .send({ firstName: 'Dan', lastName: 'Cohen', amount: 522 });
    expect(reponse.status).toBe(201);

    await videLaConduite(ecranAutre);
    expect(recu).toEqual([]);

    ecranAutre.disconnect();
  });
});
