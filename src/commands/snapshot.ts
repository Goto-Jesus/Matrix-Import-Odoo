import { searchRead } from '../api/odoo';
import { saveSnapshot, makeTimestamp, Snapshot } from '../state/manager';

export async function runSnapshot(label?: string): Promise<void> {
  const timestamp = makeTimestamp();
  const snapshotLabel = label || `snapshot-${timestamp}`;

  console.log('\n============================================================');
  console.log('ODOO 19 — Знімок поточного стану');
  console.log('============================================================\n');

  console.log('[1] Завантаження шаблонів товарів...');
  const productTemplates = await searchRead('product.template', [], [
    'id', 'name', 'type', 'categ_id', 'attribute_line_ids', 'active',
  ]);
  console.log(`    Знайдено: ${productTemplates.length}`);

  console.log('[2] Завантаження атрибутів...');
  const productAttributes = await searchRead('product.attribute', [], [
    'id', 'name', 'value_ids', 'create_variant',
  ]);
  console.log(`    Знайдено: ${productAttributes.length}`);

  console.log('[3] Завантаження значень атрибутів...');
  const productAttributeValues = await searchRead('product.attribute.value', [], [
    'id', 'name', 'attribute_id',
  ]);
  console.log(`    Знайдено: ${productAttributeValues.length}`);

  console.log('[4] Завантаження варіантів товарів...');
  const productVariants = await searchRead('product.product', [], [
    'id', 'name', 'display_name', 'product_tmpl_id', 'product_template_attribute_value_ids', 'active',
  ]);
  console.log(`    Знайдено: ${productVariants.length}`);

  console.log('[5] Завантаження специфікацій (BOM)...');
  const boms = await searchRead('mrp.bom', [], [
    'id', 'product_tmpl_id', 'product_id', 'code', 'product_qty',
    'type', 'bom_line_ids', 'operation_ids',
  ]);
  console.log(`    Знайдено: ${boms.length}`);

  console.log('[6] Завантаження рядків специфікацій (BOM lines)...');
  // operation_id — ключове поле "Спожитий в операції"
  const bomLines = await searchRead('mrp.bom.line', [], [
    'id', 'bom_id', 'product_id', 'product_qty', 'product_uom_id', 'operation_id',
  ]);
  console.log(`    Знайдено: ${bomLines.length}`);

  console.log('[7] Завантаження операцій специфікацій (BOM operations)...');
  // mrp.routing.workcenter — операції прив'язані до BOM з прив'язкою до робочого центру
  const bomOperations = await searchRead('mrp.routing.workcenter', [], [
    'id', 'name', 'bom_id', 'workcenter_id', 'time_cycle_manual', 'sequence',
  ]);
  console.log(`    Знайдено: ${bomOperations.length}`);

  console.log('[8] Завантаження робочих центрів...');
  const workcenters = await searchRead('mrp.workcenter', [], [
    'id', 'name', 'code', 'active',
  ]);
  console.log(`    Знайдено: ${workcenters.length}`);

  console.log('[9] Завантаження одиниць виміру...');
  const uoms = await searchRead('uom.uom', [], [
    'id', 'name', 'factor',
  ]);
  console.log(`    Знайдено: ${uoms.length}`);

  const snapshot: Snapshot = {
    timestamp,
    label: snapshotLabel,
    data: {
      productTemplates,
      productAttributes,
      productAttributeValues,
      productVariants,
      boms,
      bomLines,
      bomOperations,
      workcenters,
      uoms,
    },
  };

  saveSnapshot(snapshot);

  // Перевіряємо скільки BOM lines мають прив'язку до операції
  const linesWithOp = bomLines.filter((l: any) => l.operation_id && l.operation_id !== false).length;

  console.log('\n============================================================');
  console.log('ПІДСУМОК ЗНІМКУ');
  console.log('============================================================');
  console.log(`Мітка:                    ${snapshotLabel}`);
  console.log(`Часова позначка:          ${timestamp}`);
  console.log(`Шаблони товарів:          ${productTemplates.length}`);
  console.log(`Атрибути:                 ${productAttributes.length}`);
  console.log(`Значення атрибутів:       ${productAttributeValues.length}`);
  console.log(`Варіанти:                 ${productVariants.length}`);
  console.log(`BOMs:                     ${boms.length}`);
  console.log(`BOM Lines:                ${bomLines.length}`);
  console.log(`  ↳ з прив'язкою до операції: ${linesWithOp} / ${bomLines.length}`);
  console.log(`BOM Операції (цехи):      ${bomOperations.length}`);
  console.log(`Робочі центри:            ${workcenters.length}`);
  console.log(`Одиниці виміру:           ${uoms.length}`);
  console.log('============================================================\n');
}
