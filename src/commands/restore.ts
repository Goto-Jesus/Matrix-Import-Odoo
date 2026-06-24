import { unlink } from '../api/odoo';
import { loadCreatedIds, listSnapshots, CreatedIds } from '../state/manager';

export async function runRestore(timestamp?: string): Promise<void> {
  console.log('\n============================================================');
  console.log('ODOO 19 — Відкат змін');
  console.log('============================================================\n');

  // Якщо timestamp не вказано — показати список доступних
  if (!timestamp) {
    const snapshots = listSnapshots();
    if (snapshots.length === 0) {
      console.log('[!] Знімків не знайдено. Спочатку виконайте: npm run snapshot');
      return;
    }

    console.log('Доступні знімки:');
    snapshots.forEach((s, i) => {
      console.log(`  [${i + 1}] ${s.timestamp}  —  ${s.label}`);
    });
    console.log('\nДля відкату виконайте: npm run restore -- <timestamp>');
    return;
  }

  const created = loadCreatedIds(timestamp);
  if (!created) {
    console.log(`[!] Файл created.json для знімку "${timestamp}" не знайдено.`);
    console.log('    Відкат можливий лише якщо до цього виконувався імпорт.');
    return;
  }

  console.log(`Відкат знімку: ${timestamp} (${created.label})`);
  console.log(`Дата імпорту:  ${created.createdAt}\n`);

  const stats = { deleted: 0, errors: 0 };

  // Порядок важливий: спочатку дочірні записи, потім батьківські
  await deleteEntities('BOM Lines', 'mrp.bom.line', created.ids.bomLines, stats);
  await deleteEntities('BOM Операції', 'mrp.routing.workcenter', created.ids.bomOperations, stats);
  await deleteEntities('BOMs', 'mrp.bom', created.ids.boms, stats);
  await deleteEntities('Варіанти товарів', 'product.product', created.ids.productVariants, stats);
  await deleteEntities('Шаблони товарів', 'product.template', created.ids.productTemplates, stats);
  await deleteEntities('Значення атрибутів', 'product.attribute.value', created.ids.productAttributeValues, stats);
  await deleteEntities('Атрибути', 'product.attribute', created.ids.productAttributes, stats);
  await deleteEntities('Робочі центри', 'mrp.workcenter', created.ids.workcenters, stats);

  console.log('\n============================================================');
  console.log('ПІДСУМОК ВІДКАТУ');
  console.log('============================================================');
  console.log(`Видалено записів: ${stats.deleted}`);
  console.log(`Помилок:          ${stats.errors}`);
  console.log('============================================================\n');
}

async function deleteEntities(
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
    console.log(`  [OK] ${label}: видалено ${ids.length} записів`);
  } catch (err: any) {
    stats.errors += ids.length;
    console.log(`  [!!] ${label}: помилка — ${err.message}`);
  }
}
