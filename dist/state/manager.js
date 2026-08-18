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
exports.saveSnapshot = saveSnapshot;
exports.saveCreatedIds = saveCreatedIds;
exports.saveImportRecord = saveImportRecord;
exports.loadImportRecord = loadImportRecord;
exports.listImports = listImports;
exports.loadLatestSnapshot = loadLatestSnapshot;
exports.loadSnapshot = loadSnapshot;
exports.loadCreatedIds = loadCreatedIds;
exports.listSnapshots = listSnapshots;
exports.makeTimestamp = makeTimestamp;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const STATE_DIR = path.join(process.cwd(), 'state', 'snapshots');
function snapshotDir(timestamp) {
    return path.join(STATE_DIR, timestamp);
}
function saveSnapshot(snapshot) {
    const dir = snapshotDir(snapshot.timestamp);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'snapshot.json');
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    // Також зберігаємо index для зручного перегляду
    updateIndex(snapshot.timestamp, snapshot.label, 'snapshot');
    console.log(`[OK] Знімок збережено: state/snapshots/${snapshot.timestamp}/snapshot.json`);
}
function saveCreatedIds(created) {
    const dir = snapshotDir(created.snapshotTimestamp);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'created.json');
    fs.writeFileSync(filePath, JSON.stringify(created, null, 2), 'utf-8');
    console.log(`[OK] Створені ID збережено: state/snapshots/${created.snapshotTimestamp}/created.json`);
}
function importsDir(snapshotTimestamp) {
    return path.join(snapshotDir(snapshotTimestamp), 'imports');
}
function sanitizeLabel(label) {
    return label.replace(/[<>:"/\\|?*]/g, '_').trim();
}
function saveImportRecord(snapshotTimestamp, label, ids) {
    const dir = importsDir(snapshotTimestamp);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${sanitizeLabel(label)}.json`);
    // Якщо цей диван вже імпортувався раніше — мержимо ID (повторні запуски)
    let mergedIds = ids;
    if (fs.existsSync(filePath)) {
        const prev = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const merge = (a, b) => [...new Set([...a, ...b])];
        mergedIds = {
            productTemplates: merge(prev.ids.productTemplates, ids.productTemplates),
            productVariants: merge(prev.ids.productVariants, ids.productVariants),
            productAttributes: merge(prev.ids.productAttributes, ids.productAttributes),
            productAttributeValues: merge(prev.ids.productAttributeValues, ids.productAttributeValues),
            boms: merge(prev.ids.boms, ids.boms),
            bomLines: merge(prev.ids.bomLines, ids.bomLines),
            bomOperations: merge(prev.ids.bomOperations, ids.bomOperations),
            workcenters: merge(prev.ids.workcenters, ids.workcenters),
        };
    }
    const record = { snapshotTimestamp, label, createdAt: new Date().toISOString(), ids: mergedIds };
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
    console.log(`[OK] Import record збережено: state/snapshots/${snapshotTimestamp}/imports/${sanitizeLabel(label)}.json`);
}
function loadImportRecord(snapshotTimestamp, label) {
    const filePath = path.join(importsDir(snapshotTimestamp), `${sanitizeLabel(label)}.json`);
    if (!fs.existsSync(filePath))
        return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function listImports(snapshotTimestamp) {
    const dir = importsDir(snapshotTimestamp);
    if (!fs.existsSync(dir))
        return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, ''));
}
function loadLatestSnapshot() {
    const snapshots = listSnapshots();
    if (snapshots.length === 0)
        return null;
    const latest = snapshots[snapshots.length - 1];
    return loadSnapshot(latest.timestamp);
}
function loadSnapshot(timestamp) {
    const filePath = path.join(snapshotDir(timestamp), 'snapshot.json');
    if (!fs.existsSync(filePath))
        return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}
function loadCreatedIds(timestamp) {
    const filePath = path.join(snapshotDir(timestamp), 'created.json');
    if (!fs.existsSync(filePath))
        return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}
function listSnapshots() {
    const indexPath = path.join(STATE_DIR, 'index.json');
    if (!fs.existsSync(indexPath))
        return [];
    const raw = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(raw);
}
function updateIndex(timestamp, label, type) {
    const indexPath = path.join(STATE_DIR, 'index.json');
    const entries = listSnapshots();
    const existing = entries.findIndex(e => e.timestamp === timestamp);
    if (existing >= 0) {
        entries[existing] = { timestamp, label, type };
    }
    else {
        entries.push({ timestamp, label, type });
    }
    fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf-8');
}
function makeTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
