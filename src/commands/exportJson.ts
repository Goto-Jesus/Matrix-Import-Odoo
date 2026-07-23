import * as fs from 'fs';
import * as path from 'path';
import { parseDocToJson } from '../tools/docToJson';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npm run export-json <path-to-md-file-or-directory>');
  process.exit(1);
}

const absInput = path.resolve(inputPath);
if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

function findLatestSnapshot(): string | undefined {
  const indexPath = path.join(process.cwd(), 'state', 'snapshots', 'index.json');
  if (!fs.existsSync(indexPath)) return undefined;
  const index: { timestamp: string }[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (!index.length) return undefined;
  const latest = index[index.length - 1];
  return path.join(process.cwd(), 'state', 'snapshots', latest.timestamp, 'snapshot.json');
}

const snapshotPath = findLatestSnapshot();
if (snapshotPath) {
  console.log(`Using snapshot: ${path.relative(process.cwd(), snapshotPath)}`);
} else {
  console.log('No snapshot found — exporting without Odoo IDs');
}

const outDir = path.join(process.cwd(), 'exports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function exportFile(filePath: string) {
  const result = parseDocToJson(filePath, snapshotPath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const outPath = path.join(outDir, `${baseName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nParsed ${result.boms.length} BOMs from "${result.sourceFile}"`);
  result.boms.forEach((b, i) => {
    const varId = b.product.odooVariantId ? ` [variant=${b.product.odooVariantId}]` : '';
    console.log(`  BOM ${i + 1}: ${b.product.variantDisplayName}${varId}`);
    console.log(`    Operations: ${b.operations.map(o => o.name).join(' | ')}`);
    console.log(`    Components: ${b.components.length}`);
  });
  console.log(`Output: ${outPath}`);
}

const stat = fs.statSync(absInput);
if (stat.isDirectory()) {
  const files = fs.readdirSync(absInput).filter(f => f.endsWith('.md'));
  console.log(`Processing ${files.length} files from directory: ${absInput}`);
  for (const file of files) {
    exportFile(path.join(absInput, file));
  }
} else {
  exportFile(absInput);
}
