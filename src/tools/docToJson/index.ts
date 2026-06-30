import * as fs from 'fs';
import * as path from 'path';
import { parseDoc } from './parser';
import { OdooImportJson } from './types';
import { enrichBoms, SnapshotData } from './enricher';

export function parseDocToJson(filePath: string, snapshotPath?: string): OdooImportJson {
  const content = fs.readFileSync(filePath, 'utf-8');
  const boms = parseDoc(content);

  if (snapshotPath && fs.existsSync(snapshotPath)) {
    const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    enrichBoms(boms, raw.data as SnapshotData);
  }

  return {
    sourceFile: path.basename(filePath),
    generatedAt: new Date().toISOString(),
    boms,
  };
}
