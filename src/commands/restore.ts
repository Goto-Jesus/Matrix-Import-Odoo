import { unlink } from '../api/odoo';
import { listSnapshots, listImports, loadImportRecord, type ImportIds } from '../state/manager';

export async function runRestore(arg?: string): Promise<void> {
  console.log('\n============================================================');
  console.log('ODOO 19 — Відкат змін');
  console.log('============================================================\n');

  if (!arg) {
    showAvailable();
    return;
  }

  if (arg === 'all') {
    await restoreAll();
    return;
  }

  await restoreSingle(arg);
}

// ─── List ─────────────────────────────────────────────────────────────────────

function showAvailable(): void {
  const allImports = collectAllImports();

  if (allImports.length === 0) {
    console.log('[!] Імпортів не знайдено. Спочатку виконайте npm run snapshot, потім імпорт.');
    return;
  }

  console.log('Доступні імпорти:\n');
  for (const { label, timestamp, createdAt } of allImports) {
    console.log(`  • ${label}  (${createdAt.slice(0, 10)})`);
  }

  console.log('\nДля відкату одного:  npm run restore -- "<назва>"');
  console.log('Для відкату всього:  npm run restore -- all');
}

// ─── Single ───────────────────────────────────────────────────────────────────

async function restoreSingle(label: string): Promise<void> {
  const found = findImport(label);
  if (!found) {
    console.log(`[!] Імпорт "${label}" не знайдено.`);
    console.log('    Перевірте назву: npm run restore');
    return;
  }

  console.log(`Відкат імпорту: "${found.record.label}"`);
  console.log(`Дата імпорту:   ${found.record.createdAt}\n`);

  await deleteAll(found.record.ids);
}

// ─── All ──────────────────────────────────────────────────────────────────────

async function restoreAll(): Promise<void> {
  const allImports = collectAllImports();

  if (allImports.length === 0) {
    console.log('[!] Імпортів не знайдено.');
    return;
  }

  console.log(`Видалення всіх імпортів (${allImports.length}):\n`);

  const merged: ImportIds = {
    productTemplates: [], productVariants: [], productAttributes: [],
    productAttributeValues: [], boms: [], bomLines: [], bomOperations: [], workcenters: [],
  };

  const merge = (a: number[], b: number[]) => [...new Set([...a, ...b])];

  for (const { label, record } of allImports) {
    console.log(`  • "${label}": ${record.ids.boms.length} BOMs`);
    merged.productTemplates       = merge(merged.productTemplates,       record.ids.productTemplates);
    merged.productVariants        = merge(merged.productVariants,        record.ids.productVariants);
    merged.productAttributes      = merge(merged.productAttributes,      record.ids.productAttributes);
    merged.productAttributeValues = merge(merged.productAttributeValues, record.ids.productAttributeValues);
    merged.boms                   = merge(merged.boms,                   record.ids.boms);
    merged.bomLines               = merge(merged.bomLines,               record.ids.bomLines);
    merged.bomOperations          = merge(merged.bomOperations,          record.ids.bomOperations);
    merged.workcenters            = merge(merged.workcenters,            record.ids.workcenters);
  }

  console.log();
  await deleteAll(merged);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectAllImports(): Array<{ label: string; timestamp: string; createdAt: string; record: ReturnType<typeof loadImportRecord> & {} }> {
  const result: Array<{ label: string; timestamp: string; createdAt: string; record: NonNullable<ReturnType<typeof loadImportRecord>> }> = [];

  for (const snapshot of listSnapshots()) {
    for (const label of listImports(snapshot.timestamp)) {
      const record = loadImportRecord(snapshot.timestamp, label);
      if (record) result.push({ label, timestamp: snapshot.timestamp, createdAt: record.createdAt, record });
    }
  }

  return result;
}

function findImport(label: string): { record: NonNullable<ReturnType<typeof loadImportRecord>> } | null {
  for (const snapshot of [...listSnapshots()].reverse()) {
    const record = loadImportRecord(snapshot.timestamp, label);
    if (record) return { record };
  }
  return null;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function deleteAll(ids: ImportIds): Promise<void> {
  const stats = { deleted: 0, errors: 0 };

  await del('BOM Lines',          'mrp.bom.line',            ids.bomLines,              stats);
  await del('BOM Операції',       'mrp.routing.workcenter',  ids.bomOperations,         stats);
  await del('BOMs',               'mrp.bom',                 ids.boms,                  stats);
  await del('Варіанти товарів',   'product.product',         ids.productVariants,       stats);
  await del('Шаблони товарів',    'product.template',        ids.productTemplates,      stats);
  await del('Значення атрибутів', 'product.attribute.value', ids.productAttributeValues, stats);
  await del('Атрибути',           'product.attribute',       ids.productAttributes,     stats);
  await del('Робочі центри',      'mrp.workcenter',          ids.workcenters,           stats);

  console.log('\n============================================================');
  console.log(`Видалено: ${stats.deleted}  Помилок: ${stats.errors}`);
  console.log('============================================================\n');
}

async function del(
  label: string,
  model: string,
  ids: number[],
  stats: { deleted: number; errors: number }
): Promise<void> {
  if (!ids || ids.length === 0) {
    console.log(`  [--] ${label}: нічого видаляти`);
    return;
  }
  try {
    await unlink(model, ids);
    stats.deleted += ids.length;
    console.log(`  [OK] ${label}: видалено ${ids.length}`);
  } catch (err: any) {
    stats.errors += ids.length;
    console.log(`  [!!] ${label}: помилка — ${err.message}`);
  }
}
