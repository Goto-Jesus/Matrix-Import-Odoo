import * as fs from 'fs';
import * as path from 'path';
import type { OdooImportJson } from '../docToJson/types';
import { importAllBoms } from './importer';
import { preSeedVariants } from './resolver';

function findLatestSnapshot(): string | undefined {
  const indexPath = path.join(process.cwd(), 'state', 'snapshots', 'index.json');
  if (!fs.existsSync(indexPath)) return undefined;
  const index: { timestamp: string }[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (!index.length) return undefined;
  return path.join(process.cwd(), 'state', 'snapshots', index[index.length - 1].timestamp, 'snapshot.json');
}

export async function importFromJson(filePath: string): Promise<void> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: OdooImportJson = JSON.parse(raw);

  const snapPath = findLatestSnapshot();
  if (snapPath && fs.existsSync(snapPath)) {
    const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
    const variants = snap.data?.productVariants ?? [];
    preSeedVariants(variants);
    console.log(`[cache] Snapshot: ${variants.length} варіантів завантажено локально`);
  }

  console.log(`\nImporting ${data.boms.length} BOMs from "${data.sourceFile}"...`);
  await importAllBoms(data.boms);
}
