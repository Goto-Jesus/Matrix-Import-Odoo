import * as fs from 'fs';
import * as path from 'path';
import { authenticate } from '../api/odoo';
import { importAllTemplateBoms } from '../tools/importJson/template-bom/importer';
import type { OdooImportJson } from '../tools/docToJson/types';

async function main(): Promise<void> {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: ts-node src/commands/importTemplateBom.ts <path-to-json>');
    console.error('Example: ts-node src/commands/importTemplateBom.ts exports/Диван\\ Угол\\ Леон-Люкс\\ 140\\ Механізм.json');
    process.exit(1);
  }

  const absPath = path.resolve(jsonPath);
  if (!fs.existsSync(absPath)) {
    console.error(`Файл не знайдено: ${absPath}`);
    process.exit(1);
  }

  const data: OdooImportJson = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  console.log(`[import] Файл: ${data.sourceFile}`);
  console.log(`[import] BOM записів: ${data.boms.length}`);
  console.log(`[import] Режим: template-level BOM (product_id = false)`);

  await authenticate();
  await importAllTemplateBoms(data.boms, data.sourceFile);
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
