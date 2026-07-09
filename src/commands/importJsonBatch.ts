import * as fs from 'fs';
import * as path from 'path';
import type { OdooImportJson } from '../tools/docToJson/types';
import { batchImportAllBoms } from '../tools/importJson/batchImporter';
import { preSeedVariants } from '../tools/importJson/resolver';

function findLatestSnapshot(): string | undefined {
  const indexPath = path.join(process.cwd(), 'state', 'snapshots', 'index.json');
  if (!fs.existsSync(indexPath)) return undefined;
  const index: { timestamp: string }[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (!index.length) return undefined;
  return path.join(process.cwd(), 'state', 'snapshots', index[index.length - 1].timestamp, 'snapshot.json');
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npm run import-json-batch <path-to-json-file>');
  process.exit(1);
}

const absInput = path.resolve(inputPath);
if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

async function run(): Promise<void> {
  const raw = fs.readFileSync(absInput, 'utf-8');
  const data: OdooImportJson = JSON.parse(raw);

  const snapPath = findLatestSnapshot();
  if (snapPath && fs.existsSync(snapPath)) {
    const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
    const variants = snap.data?.productVariants ?? [];
    preSeedVariants(variants);
    console.log(`[cache] Snapshot: ${variants.length} варіантів завантажено локально`);
  }

  console.log(`\nBatch-import: ${data.boms.length} BOM-груп з "${data.sourceFile}"`);
  await batchImportAllBoms(data.boms);
}

run().catch((err: Error) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
