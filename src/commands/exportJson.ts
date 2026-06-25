import * as fs from 'fs';
import * as path from 'path';
import { parseDocToJson } from '../tools/docToJson';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npm run export-json <path-to-md-file>');
  process.exit(1);
}

const absInput = path.resolve(inputPath);
if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

const result = parseDocToJson(absInput);

const outDir = path.join(process.cwd(), 'exports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const baseName = path.basename(absInput, path.extname(absInput));
const outPath = path.join(outDir, `${baseName}.json`);

fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

console.log(`\nParsed ${result.boms.length} BOMs from "${result.sourceFile}"`);
result.boms.forEach((b, i) => {
  console.log(`  BOM ${i + 1}: ${b.product.variantDisplayName}`);
  console.log(`    Operations: ${b.operations.map(o => o.name).join(' | ')}`);
  console.log(`    Components: ${b.components.length}`);
});
console.log(`\nOutput: ${outPath}`);
