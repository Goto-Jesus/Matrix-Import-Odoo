import * as path from 'path';
import * as fs from 'fs';
import { importFromJson } from '../tools/importJson';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npm run import-json <path-to-json-file>');
  process.exit(1);
}

const absInput = path.resolve(inputPath);
if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

importFromJson(absInput).catch((err: Error) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
