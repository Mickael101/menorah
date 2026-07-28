import { getDb, saveDatabase } from '../db/init';
import { Config, DisplaySettings, DEFAULT_DISPLAY_SETTINGS } from '../models/types';
import { ConfigRow, rowToConfig } from '../models/config';
import { eventService, UnknownEventError } from './event.service';
import { sceneService } from './scene.service';

// La source de verite est `event_configs`. L'ancienne table `config` reste en
// base, en lecture seule, jusqu'a sa suppression au LOT 6 : la migration l'a
// recopiee une fois, plus rien ne l'ecrit.
class ConfigService {
  get(eventId: number): Config {
    const db = getDb();
    const result = db.exec('SELECT * FROM event_configs WHERE event_id = ?', [eventId]);

    if (result.length > 0 && result[0].values.length > 0) {
      const columns = result[0].columns;
      const values = result[0].values[0];
      const row: ConfigRow = {
        event_id: values[columns.indexOf('event_id')] as number,
        goal_amount: values[columns.indexOf('goal_amount')] as number,
        preset_amounts: values[columns.indexOf('preset_amounts')] as string,
        menorah_segments: values[columns.indexOf('menorah_segments')] as string,
        display_settings: (values[columns.indexOf('display_settings')] as string) || '{}',
        updated_at: values[columns.indexOf('updated_at')] as string
      };
      return rowToConfig(row);
    }

    // Une soiree sans ligne de configuration est normale : elle n'a rien regle
    // encore. Une soiree qui n'existe pas ne l'est pas — sans cette
    // distinction, un identifiant errone rendrait une soiree vide parfaitement
    // credible au lieu d'une erreur.
    this.assertEventExists(eventId);

    return {
      goalAmount: 10000000,
      presetAmounts: [1800, 3600, 18000, 36000, 100000],
      menorahSegments: [],
      displaySettings: { ...DEFAULT_DISPLAY_SETTINGS }
    };
  }

  update(eventId: number, data: Partial<Config>): Config {
    this.assertEventExists(eventId);

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.goalAmount !== undefined) {
      updates.push('goal_amount = ?');
      values.push(data.goalAmount);
    }

    if (data.presetAmounts !== undefined) {
      updates.push('preset_amounts = ?');
      values.push(JSON.stringify(data.presetAmounts));
    }

    if (data.menorahSegments !== undefined) {
      updates.push('menorah_segments = ?');
      values.push(JSON.stringify(data.menorahSegments));
    }

    if (data.displaySettings !== undefined) {
      this.resolveSceneBinding(data.displaySettings);
      updates.push('display_settings = ?');
      values.push(JSON.stringify(data.displaySettings));
    }

    if (updates.length === 0) {
      return this.get(eventId);
    }

    updates.push("updated_at = datetime('now')");

    const db = getDb();
    // Une soiree n'a de ligne de configuration qu'a partir de son premier
    // reglage. Sans cette insertion, l'UPDATE toucherait zero ligne et la route
    // repondrait 200 en n'ayant rien enregistre.
    db.run('INSERT OR IGNORE INTO event_configs (event_id) VALUES (?)', [eventId]);
    db.run(`UPDATE event_configs SET ${updates.join(', ')} WHERE event_id = ?`, [...values, eventId]);
    saveDatabase();

    return this.get(eventId);
  }

  // Le serveur est la seule source de verite : sceneUrl est toujours derive
  // de sceneId au moment de la sauvegarde, jamais accepte du client. En mode
  // scene, une reference morte est une erreur de requete (400 via la route).
  private resolveSceneBinding(settings: DisplaySettings): void {
    if (settings.visualMode === 'scene') {
      const scene = settings.sceneId !== null ? sceneService.get(settings.sceneId) : null;
      if (!scene) {
        throw new Error('sceneId must reference an existing scene when visualMode is "scene"');
      }
      settings.sceneUrl = scene.url;
      return;
    }
    const scene = settings.sceneId !== null ? sceneService.get(settings.sceneId) : null;
    settings.sceneUrl = scene ? scene.url : null;
  }

  private assertEventExists(eventId: number): void {
    if (eventService.getById(eventId) === null) {
      throw new UnknownEventError(eventId);
    }
  }
}

export const configService = new ConfigService();
