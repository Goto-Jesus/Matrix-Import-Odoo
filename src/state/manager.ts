import * as fs from 'fs';
import * as path from 'path';

const STATE_DIR = path.join(process.cwd(), 'state', 'snapshots');

export interface Snapshot {
  timestamp: string;
  label: string;
  data: {
    productTemplates: any[];
    productAttributes: any[];
    productAttributeValues: any[];
    productVariants: any[];
    boms: any[];
    bomLines: any[];
    bomOperations: any[];   // mrp.routing.workcenter — операції в специфікації
    workcenters: any[];
    uoms: any[];
  };
}

export interface CreatedIds {
  snapshotTimestamp: string;
  label: string;
  createdAt: string;
  ids: {
    productTemplates: number[];
    productVariants: number[];
    productAttributes: number[];
    productAttributeValues: number[];
    boms: number[];
    bomLines: number[];
    bomOperations: number[];
    workcenters: number[];
  };
}

function snapshotDir(timestamp: string): string {
  return path.join(STATE_DIR, timestamp);
}

export function saveSnapshot(snapshot: Snapshot): void {
  const dir = snapshotDir(snapshot.timestamp);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, 'snapshot.json');
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Також зберігаємо index для зручного перегляду
  updateIndex(snapshot.timestamp, snapshot.label, 'snapshot');

  console.log(`[OK] Знімок збережено: state/snapshots/${snapshot.timestamp}/snapshot.json`);
}

export function saveCreatedIds(created: CreatedIds): void {
  const dir = snapshotDir(created.snapshotTimestamp);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, 'created.json');
  fs.writeFileSync(filePath, JSON.stringify(created, null, 2), 'utf-8');

  console.log(`[OK] Створені ID збережено: state/snapshots/${created.snapshotTimestamp}/created.json`);
}

// ─── Per-import records ───────────────────────────────────────────────────────

export type ImportIds = CreatedIds['ids'];

export interface ImportRecord {
  snapshotTimestamp: string;
  label: string;
  createdAt: string;
  ids: ImportIds;
}

function importsDir(snapshotTimestamp: string): string {
  return path.join(snapshotDir(snapshotTimestamp), 'imports');
}

function sanitizeLabel(label: string): string {
  return label.replace(/[<>:"/\\|?*]/g, '_').trim();
}

export function saveImportRecord(snapshotTimestamp: string, label: string, ids: ImportIds): void {
  const dir = importsDir(snapshotTimestamp);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${sanitizeLabel(label)}.json`);

  // Якщо цей диван вже імпортувався раніше — мержимо ID (повторні запуски)
  let mergedIds = ids;
  if (fs.existsSync(filePath)) {
    const prev: ImportRecord = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const merge = (a: number[], b: number[]) => [...new Set([...a, ...b])];
    mergedIds = {
      productTemplates:       merge(prev.ids.productTemplates,       ids.productTemplates),
      productVariants:        merge(prev.ids.productVariants,        ids.productVariants),
      productAttributes:      merge(prev.ids.productAttributes,      ids.productAttributes),
      productAttributeValues: merge(prev.ids.productAttributeValues, ids.productAttributeValues),
      boms:                   merge(prev.ids.boms,                   ids.boms),
      bomLines:               merge(prev.ids.bomLines,               ids.bomLines),
      bomOperations:          merge(prev.ids.bomOperations,          ids.bomOperations),
      workcenters:            merge(prev.ids.workcenters,            ids.workcenters),
    };
  }

  const record: ImportRecord = { snapshotTimestamp, label, createdAt: new Date().toISOString(), ids: mergedIds };
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
  console.log(`[OK] Import record збережено: state/snapshots/${snapshotTimestamp}/imports/${sanitizeLabel(label)}.json`);
}

export function loadImportRecord(snapshotTimestamp: string, label: string): ImportRecord | null {
  const filePath = path.join(importsDir(snapshotTimestamp), `${sanitizeLabel(label)}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ImportRecord;
}

export function listImports(snapshotTimestamp: string): string[] {
  const dir = importsDir(snapshotTimestamp);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''));
}

export function loadLatestSnapshot(): Snapshot | null {
  const snapshots = listSnapshots();
  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  return loadSnapshot(latest.timestamp);
}

export function loadSnapshot(timestamp: string): Snapshot | null {
  const filePath = path.join(snapshotDir(timestamp), 'snapshot.json');
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Snapshot;
}

export function loadCreatedIds(timestamp: string): CreatedIds | null {
  const filePath = path.join(snapshotDir(timestamp), 'created.json');
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CreatedIds;
}

export function listSnapshots(): Array<{ timestamp: string; label: string; type: string }> {
  const indexPath = path.join(STATE_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) return [];

  const raw = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(raw);
}

function updateIndex(timestamp: string, label: string, type: string): void {
  const indexPath = path.join(STATE_DIR, 'index.json');
  const entries = listSnapshots();

  const existing = entries.findIndex(e => e.timestamp === timestamp);
  if (existing >= 0) {
    entries[existing] = { timestamp, label, type };
  } else {
    entries.push({ timestamp, label, type });
  }

  fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf-8');
}

export function makeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
