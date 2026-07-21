import path from 'path';

const backendRoot = path.resolve(__dirname, '../..');
const configuredDataDir = process.env.DATA_DIR?.trim();

export const databaseFilePath = configuredDataDir
  ? path.join(path.resolve(configuredDataDir), 'donations.db')
  : path.join(backendRoot, 'db', 'donations.db');

export const uploadsRoot = configuredDataDir
  ? path.join(path.resolve(configuredDataDir), 'uploads')
  : path.join(backendRoot, 'public', 'uploads');

export const gifAudioFilePath = configuredDataDir
  ? path.join(path.resolve(configuredDataDir), 'gif-audio.json')
  : path.join(backendRoot, 'data', 'gif-audio.json');
