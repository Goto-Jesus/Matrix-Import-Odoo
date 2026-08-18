"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const docToJson_1 = require("../tools/docToJson");
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
function findLatestSnapshot() {
    const indexPath = path.join(process.cwd(), 'state', 'snapshots', 'index.json');
    if (!fs.existsSync(indexPath))
        return undefined;
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    if (!index.length)
        return undefined;
    const latest = index[index.length - 1];
    return path.join(process.cwd(), 'state', 'snapshots', latest.timestamp, 'snapshot.json');
}
const snapshotPath = findLatestSnapshot();
if (snapshotPath) {
    console.log(`Using snapshot: ${path.relative(process.cwd(), snapshotPath)}`);
}
else {
    console.log('No snapshot found — exporting without Odoo IDs');
}
const outDir = path.join(process.cwd(), 'exports');
if (!fs.existsSync(outDir))
    fs.mkdirSync(outDir, { recursive: true });
function exportFile(filePath) {
    const result = (0, docToJson_1.parseDocToJson)(filePath, snapshotPath);
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
}
else {
    exportFile(absInput);
}
