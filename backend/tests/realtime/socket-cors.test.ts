import { describe, it, expect, afterEach } from 'vitest';
import { socketCorsOrigin } from '../../src/services/socket.service';

// C8 (partie socket) : le CORS du socket lit CORS_ORIGIN. Non definie, le
// comportement reste EXACTEMENT celui d avant, pour ne rien regresser sur les
// ecrans en production (meme origine).

describe('CORS du socket via CORS_ORIGIN', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  it('non definie : garde les deux origines de developpement, inchangees', () => {
    delete process.env.CORS_ORIGIN;
    expect(socketCorsOrigin()).toEqual(['http://localhost:5173', 'http://localhost:3000']);
  });

  it('vide ou espaces : retombe sur le comportement par defaut', () => {
    process.env.CORS_ORIGIN = '   ';
    expect(socketCorsOrigin()).toEqual(['http://localhost:5173', 'http://localhost:3000']);
  });

  it('liste separee par virgules : origines decoupees et rognees', () => {
    process.env.CORS_ORIGIN = 'https://a.example.com, https://b.example.com';
    expect(socketCorsOrigin()).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('une seule origine : renvoyee telle quelle dans une liste', () => {
    process.env.CORS_ORIGIN = 'https://dons.example.com';
    expect(socketCorsOrigin()).toEqual(['https://dons.example.com']);
  });

  it('* seul : autorise toutes les origines', () => {
    process.env.CORS_ORIGIN = '*';
    expect(socketCorsOrigin()).toBe('*');
  });
});
