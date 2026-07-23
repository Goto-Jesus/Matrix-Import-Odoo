import * as fs from 'fs';
import * as path from 'path';
import { saveImportRecord } from './manager';

const _ids = {
  productTemplates:      [] as number[],
  productVariants:       [] as number[],
  productAttributes:     [] as number[],
  productAttributeValues: [] as number[],
  boms:                  [] as number[],
  bomLines:              [] as number[],
  bomOperations:         [] as number[],
  workcenters:           [] as number[],
};

export const track = {
  template:       (id: number)    => { _ids.productTemplates.push(id); },
  attribute:      (id: number)    => { _ids.productAttributes.push(id); },
  attributeValue: (id: number)    => { _ids.productAttributeValues.push(id); },
  workcenter:     (id: number)    => { _ids.workcenters.push(id); },
  bom:            (id: number)    => { _ids.boms.push(id); },
  boms:           (ids: number[]) => { _ids.boms.push(...ids); },
  operation:      (id: number)    => { _ids.bomOperations.push(id); },
  operations:     (ids: number[]) => { _ids.bomOperations.push(...ids); },
  bomLine:        (id: number)    => { _ids.bomLines.push(id); },
  bomLines:       (ids: number[]) => { _ids.bomLines.push(...ids); },
};

export function resetSession(): void {
  _ids.productTemplates      = [];
  _ids.productVariants       = [];
  _ids.productAttributes     = [];
  _ids.productAttributeValues = [];
  _ids.boms                  = [];
  _ids.bomLines              = [];
  _ids.bomOperations         = [];
  _ids.workcenters           = [];
}

function findLatestSnapshotTimestamp(): string | null {
  const indexPath = path.join(process.cwd(), 'state', 'snapshots', 'index.json');
  if (!fs.existsSync(indexPath)) return null;
  const entries: { timestamp: string }[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (!entries.length) return null;
  return entries[entries.length - 1].timestamp;
}

export function saveSession(label?: string): void {
  const snapshotTimestamp = findLatestSnapshotTimestamp();
  if (!snapshotTimestamp) {
    console.warn('[tracker] Snapshot не знайдено — import record не збережено. Виконайте npm run snapshot перед імпортом.');
    return;
  }

  const total = Object.values(_ids).reduce((s, arr) => s + arr.length, 0);
  if (total === 0) {
    console.log('[tracker] Нічого нового не створено — import record пропущено.');
    return;
  }

  const recordLabel = label ?? `import-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}`;

  saveImportRecord(snapshotTimestamp, recordLabel, { ..._ids });

  console.log(
    `[tracker] "${recordLabel}" → ` +
    `BOMs: ${_ids.boms.length}, ops: ${_ids.bomOperations.length}, lines: ${_ids.bomLines.length}, ` +
    `templates: ${_ids.productTemplates.length}`
  );
}
