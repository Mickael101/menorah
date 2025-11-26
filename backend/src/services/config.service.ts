import { getDb, saveDatabase } from '../db/init';
import { Config } from '../models/types';
import { ConfigRow, rowToConfig } from '../models/config';

class ConfigService {
  // Get current configuration
  get(): Config {
    const db = getDb();
    const result = db.exec('SELECT * FROM config WHERE id = 1');

    if (result.length > 0 && result[0].values.length > 0) {
      const columns = result[0].columns;
      const values = result[0].values[0];
      const row: ConfigRow = {
        id: values[columns.indexOf('id')] as number,
        goal_amount: values[columns.indexOf('goal_amount')] as number,
        preset_amounts: values[columns.indexOf('preset_amounts')] as string,
        menorah_segments: values[columns.indexOf('menorah_segments')] as string,
        updated_at: values[columns.indexOf('updated_at')] as string
      };
      return rowToConfig(row);
    }

    // Return defaults if no config found
    return {
      goalAmount: 10000000,
      presetAmounts: [1800, 3600, 18000, 36000, 100000],
      menorahSegments: []
    };
  }

  // Update configuration
  update(data: Partial<Config>): Config {
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

    if (updates.length === 0) {
      return this.get();
    }

    updates.push("updated_at = datetime('now')");

    const db = getDb();
    db.run(`UPDATE config SET ${updates.join(', ')} WHERE id = 1`, values);
    saveDatabase();

    return this.get();
  }
}

export const configService = new ConfigService();
