import { describe, it, expect, beforeAll } from 'vitest';
import { initTestDatabase } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { donationService } from '../../src/services/donation.service';
import { configService } from '../../src/services/config.service';
import { UnknownEventError } from '../../src/services/event.service';

// Deux soirees se tiennent en meme temps. Tout ce qui suit verifie qu'aucune
// donnee de l'une ne traverse vers l'autre.
//
// Les soirees de test sont creees en `draft` a dessein : les services prennent
// un eventId explicite, aucune resolution de soiree active n'intervient ici, et
// une soiree de test `active` deplacerait la soiree active vue par les autres
// fichiers de la suite (le service de dons ecrit sur disque).

let soireeA = 0;
let soireeB = 0;

describe('isolation entre soirees', () => {
  beforeAll(async () => {
    await initTestDatabase();
    soireeA = insertEvent({ slug: 'isolation-a', name: 'Soiree A' });
    soireeB = insertEvent({ slug: 'isolation-b', name: 'Soiree B' });
  });

  describe('dons', () => {
    it('ne renvoie que les dons de la soiree demandee', () => {
      donationService.create(soireeA, { firstName: 'Ada', lastName: 'A', amount: 1000 });
      donationService.create(soireeA, { firstName: 'Bea', lastName: 'A', amount: 2000 });
      donationService.create(soireeB, { firstName: 'Cid', lastName: 'B', amount: 500 });

      const donsA = donationService.getAll(soireeA);
      const donsB = donationService.getAll(soireeB);

      expect(donsA.map((don) => don.firstName).sort()).toEqual(['Ada', 'Bea']);
      expect(donsB.map((don) => don.firstName)).toEqual(['Cid']);
    });

    it('ne compte que les dons de la soiree demandee dans les statistiques', () => {
      const statsA = donationService.getStats(soireeA);
      const statsB = donationService.getStats(soireeB);

      expect(statsA.donationCount).toBe(2);
      expect(statsA.totalAmount).toBe(3000);
      expect(statsB.donationCount).toBe(1);
      expect(statsB.totalAmount).toBe(500);
    });

    it('ne laisse pas une soiree lire un don d une autre par son identifiant', () => {
      const donDeA = donationService.create(soireeA, { firstName: 'Dov', lastName: 'A', amount: 700 });

      expect(donationService.getById(soireeA, donDeA.id)?.firstName).toBe('Dov');
      expect(donationService.getById(soireeB, donDeA.id)).toBeNull();
    });

    it('ne laisse pas une soiree modifier ni supprimer un don d une autre', () => {
      const donDeA = donationService.create(soireeA, { firstName: 'Eli', lastName: 'A', amount: 900 });

      expect(donationService.update(soireeB, donDeA.id, { amount: 1 })).toBeNull();
      expect(donationService.delete(soireeB, donDeA.id)).toBeNull();
      // Le don doit etre intact, pas seulement l'appel refuse.
      expect(donationService.getById(soireeA, donDeA.id)?.amount).toBe(900);
    });
  });

  describe('mots sacres', () => {
    it('laisse disponible sur B un mot deja pris sur A', () => {
      const motPris = 'L1_W1';
      const montantPalier1 = 2600000;

      donationService.create(soireeA, {
        firstName: 'Fay',
        lastName: 'A',
        amount: montantPalier1,
        premiumWordId: motPris
      });

      const surA = donationService.getPremiumWords(soireeA).find((mot) => mot.id === motPris);
      const surB = donationService.getPremiumWords(soireeB).find((mot) => mot.id === motPris);

      expect(surA?.available).toBe(false);
      expect(surA?.donorName).toBe('Fay A');
      expect(surB?.available).toBe(true);
      // Le nom du donateur de A ne doit pas apparaitre sur la page publique de B.
      expect(surB?.donorName).toBeUndefined();

      expect(donationService.getUsedPremiumWordIds(soireeA)).toContain(motPris);
      expect(donationService.getUsedPremiumWordIds(soireeB)).not.toContain(motPris);
    });
  });

  describe('configuration', () => {
    it('ne propage pas l objectif d une soiree a l autre', () => {
      configService.update(soireeA, { goalAmount: 4242 });

      expect(configService.get(soireeA).goalAmount).toBe(4242);
      expect(configService.get(soireeB).goalAmount).not.toBe(4242);
    });

    it('applique l objectif de la bonne soiree au calcul d avancement', () => {
      // Un mauvais appariement entre les dons et l'objectif ne leve aucune
      // erreur : il produit un pourcentage faux et silencieux.
      configService.update(soireeB, { goalAmount: 1000 });

      expect(donationService.getStats(soireeB).percentComplete).toBe(50);
    });

    it('refuse de configurer une soiree qui n existe pas', () => {
      expect(() => configService.get(999999)).toThrow(UnknownEventError);
      expect(() => configService.update(999999, { goalAmount: 10 })).toThrow(UnknownEventError);
    });

    it('enregistre la premiere configuration d une soiree qui n en avait aucune', () => {
      // event_configs n'a pas de ligne tant que personne n'a rien regle : un
      // UPDATE seul toucherait zero ligne et renverrait 200 sans rien changer.
      const soireeNeuve = insertEvent({ slug: 'isolation-neuve', name: 'Soiree neuve' });

      expect(configService.update(soireeNeuve, { goalAmount: 777 }).goalAmount).toBe(777);
      expect(configService.get(soireeNeuve).goalAmount).toBe(777);
    });
  });
});
