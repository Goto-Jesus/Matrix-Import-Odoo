import * as fs from 'fs';
import type { OdooImportJson } from '../docToJson/types';
import { importAllBoms } from './importer';

export async function importFromJson(filePath: string): Promise<void> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: OdooImportJson = JSON.parse(raw);

  console.log(`\nImporting ${data.boms.length} BOMs from "${data.sourceFile}"...`);
  await importAllBoms(data.boms);
}
