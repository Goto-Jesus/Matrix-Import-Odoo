import { create, searchRead } from '../../api/odoo';
import { getOrCreateWorkcenter } from '../../bom/product';
import { ensureVariantFromAttrs } from './resolver';
import type { BomEntry } from '../docToJson/types';

const UOM_MAP: Record<string, number> = {
  'шт': 1,
  'шт.': 1,
  'm': 8,
  'm²': 10,
  'г': 14,
  'кг': 15,
  'm³': 30,
};

function uomStrToId(uom: string): number {
  const id = UOM_MAP[uom];
  if (id === undefined) {
    console.warn(`  [WARN] Невідома одиниця "${uom}", використовується шт`);
    return 1;
  }
  return id;
}

export async function importBomEntry(entry: BomEntry): Promise<number | null> {
  const { product, operations, components } = entry;
  const bomCode = product.variantDisplayName;

  // 1. Знайти/створити вихідний варіант товару
  const resolved = await ensureVariantFromAttrs(product.templateName, product.attributes);
  if (!resolved) {
    console.warn(`  [SKIP] Не вдалося вирішити товар для: ${bomCode}`);
    return null;
  }

  // 2. Перевірити чи BOM вже існує (за product_id + code)
  const [existingBom] = await searchRead<{ id: number }>(
    'mrp.bom',
    [['product_id', '=', resolved.variantId], ['code', '=', bomCode]],
    ['id'], 1
  );
  if (existingBom) {
    console.log(`  [EXISTS] BOM (ID: ${existingBom.id}): ${bomCode}`);
    return existingBom.id;
  }

  // 3. Створити BOM
  const bomId = await create('mrp.bom', {
    product_id: resolved.variantId,
    product_tmpl_id: resolved.templateId,
    code: bomCode,
    product_qty: product.qty,
    type: 'normal',
  });
  console.log(`  [+] BOM (ID: ${bomId}): ${bomCode}`);

  // 4. Створити операції
  const opIds: number[] = [];
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const wcId = await getOrCreateWorkcenter(op.workcenterName);
    const opId = await create('mrp.routing.workcenter', {
      name: op.name,
      bom_id: bomId,
      workcenter_id: wcId,
      sequence: i + 1,
      x_studio_piece_rate_2: op.priceRate,
    });
    opIds.push(opId);
    console.log(`    [op] "${op.name}" (${op.priceRate} грн)`);
  }

  // 5. Створити рядки BOM (компоненти)
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const compResolved = await ensureVariantFromAttrs(
      comp.templateName,
      comp.attributes,
      comp.isService ?? false
    );
    if (!compResolved) {
      console.warn(`    [SKIP] Компонент: "${comp.templateName}"`);
      continue;
    }

    const operationId = opIds[comp.operationIndex] ?? false;
    await create('mrp.bom.line', {
      bom_id: bomId,
      product_id: compResolved.variantId,
      product_qty: comp.qty,
      product_uom_id: uomStrToId(comp.uom),
      sequence: i + 1,
      operation_id: operationId,
    });

    const label = comp.attributes.length
      ? `${comp.templateName} (${comp.attributes.map(a => a.value).join(', ')})`
      : comp.templateName;
    console.log(`    [+] ${label} × ${comp.qty} ${comp.uom}`);
  }

  return bomId;
}

export async function importAllBoms(boms: BomEntry[]): Promise<void> {
  let created = 0, skipped = 0, errors = 0;

  for (const entry of boms) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(entry.product.variantDisplayName);
    console.log('='.repeat(60));

    try {
      const id = await importBomEntry(entry);
      if (id !== null) created++;
      else skipped++;
    } catch (err: any) {
      console.error(`[ERROR] ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Готово. Створено: ${created} | Існує/пропущено: ${skipped} | Помилок: ${errors}`);
  console.log('='.repeat(60));
}
