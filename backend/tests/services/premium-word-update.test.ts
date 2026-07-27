import { describe, it, expect, beforeAll } from 'vitest';
import { initTestDatabase } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { donationService } from '../../src/services/donation.service';
import { validateUpdateRequest } from '../../src/models/donation';

// C9 : la route heritee appelle validateUpdateRequest(req.body) SANS
// currentAmount. Une mise a jour qui ne renvoie pas le montant ne doit jamais
// faire disparaitre le mot sacre deja enregistre. On verrouille l invariant au
// niveau du modele (le garde-fou) ET du service (le bout reellement observable).

describe('mise a jour partielle et mot sacre (C9)', () => {
  let soiree = 0;

  beforeAll(async () => {
    await initTestDatabase();
    soiree = insertEvent({ slug: 'c9-preservation', name: 'C9' });
  });

  it('sans montant a comparer, le champ mot sacre n est pas pose (ni valide contre zero)', () => {
    // Ni result.amount ni currentAmount : le mot ne peut pas etre valide. Le
    // champ doit rester absent du resultat pour que le service ne touche pas la
    // colonne, au lieu d etre calcule contre un montant de zero.
    const data = validateUpdateRequest({ firstName: 'Renomme', premiumWordId: 'L1_W1' });

    expect(data.firstName).toBe('Renomme');
    expect(data.premiumWordId).toBeUndefined();
  });

  it('avec le montant renvoye, le mot valide pour le palier est conserve', () => {
    const data = validateUpdateRequest({ amount: 2600000, premiumWordId: 'L1_W1' });
    expect(data.premiumWordId).toBe('L1_W1');
  });

  it('renommer un don sans renvoyer le montant ne fait pas disparaitre son mot sacre', () => {
    const don = donationService.create(soiree, {
      firstName: 'Sacre',
      lastName: 'Mot',
      amount: 2600000,
      premiumWordId: 'L1_W1'
    });
    expect(don.premiumWordId).toBe('L1_W1');

    // Exactement ce que produit la route heritee : validateUpdateRequest(body)
    // sans currentAmount, sur un corps qui ne renvoie pas le montant.
    const data = validateUpdateRequest({ firstName: 'Sacre II', premiumWordId: 'L1_W1' });
    const misAJour = donationService.update(soiree, don.id, data);

    expect(misAJour?.firstName).toBe('Sacre II');
    expect(misAJour?.premiumWordId).toBe('L1_W1');
  });
});
