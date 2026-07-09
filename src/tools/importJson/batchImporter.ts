import { searchRead, write, create, createMany, unlink } from '../../api/odoo';
import { getOrCreateWorkcenter } from '../../bom/product';
import { ensureVariantFromAttrs, preSeedAttributeLines } from './resolver';
import { expandEntry } from './expander';
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

function sec(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(2)}s`;
}

async function ensureVariantLimit(minLimit = 10000): Promise<void> {
  const [existing] = await searchRead<{ id: number; value: string }>(
    'ir.config_parameter',
    [['key', '=', 'product.dynamic_variant_limit']],
    ['id', 'value'], 1
  );
  if (existing) {
    const current = parseInt(existing.value, 10);
    if (current < minLimit) {
      await write('ir.config_parameter', [existing.id], { value: String(minLimit) });
      console.log(`[config] product.dynamic_variant_limit: ${current} → ${minLimit}`);
    }
  } else {
    await create('ir.config_parameter', { key: 'product.dynamic_variant_limit', value: String(minLimit) });
    console.log(`[config] product.dynamic_variant_limit = ${minLimit}`);
  }
}

async function deleteWrongBoms(code: string): Promise<void> {
  const existing = await searchRead<{ id: number }>('mrp.bom', [['code', '=', code]], ['id']);
  if (existing.length) {
    await unlink('mrp.bom', existing.map(b => b.id));
    console.log(`  [DEL] Видалено ${existing.length} BOM з кодом "${code}"`);
  }
}

// ─── Internal prepared types ─────────────────────────────────────────────────

type PreparedOp = {
  name: string;
  workcenterID: number;
  priceRate: number;
  sequence: number;
};

type PreparedComp = {
  variantId: number;
  qty: number;
  uomId: number;
  sequence: number;
  operationIndex: number;
};

type PreparedBom = {
  bomCode: string;
  variantId: number;
  templateId: number;
  qty: number;
  operations: PreparedOp[];
  components: PreparedComp[];
};

// ─── Resolve one expanded entry to IDs (no creates) ──────────────────────────

async function resolveEntry(entry: BomEntry): Promise<PreparedBom | null> {
  const resolved = await ensureVariantFromAttrs(
    entry.product.templateName,
    entry.product.attributes
  );
  if (!resolved) return null;

  const ops: PreparedOp[] = [];
  for (let i = 0; i < entry.operations.length; i++) {
    const op = entry.operations[i];
    const wcId = await getOrCreateWorkcenter(op.workcenterName);
    ops.push({ name: op.name, workcenterID: wcId, priceRate: op.priceRate, sequence: i + 1 });
  }

  const comps: PreparedComp[] = [];
  for (let i = 0; i < entry.components.length; i++) {
    const comp = entry.components[i];
    const compRes = await ensureVariantFromAttrs(
      comp.templateName,
      comp.attributes,
      comp.isService ?? false
    );
    if (!compRes) {
      console.warn(`    [SKIP comp] "${comp.templateName}"`);
      continue;
    }
    comps.push({
      variantId: compRes.variantId,
      qty: comp.qty,
      uomId: uomStrToId(comp.uom),
      sequence: i + 1,
      operationIndex: comp.operationIndex,
    });
  }

  return {
    bomCode: entry.product.variantDisplayName,
    variantId: resolved.variantId,
    templateId: resolved.templateId,
    qty: entry.product.qty,
    operations: ops,
    components: comps,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function batchImportAllBoms(boms: BomEntry[]): Promise<void> {
  const totalStart = Date.now();
  const LINE = '='.repeat(60);
  const phases: Array<{ label: string; elapsed: number }> = [];

  const phase = (label: string, start: number) => {
    const elapsed = Date.now() - start;
    phases.push({ label, elapsed });
    console.log(`[batch] ${label}: ${(elapsed / 1000).toFixed(2)}s`);
  };

  // ── Phase 0: raise variant limit ──────────────────────────────────────────
  await ensureVariantLimit(10000);

  // ── Phase 1: expand + pre-seed attributes ─────────────────────────────────
  const allExpanded = boms.flatMap(entry => expandEntry(entry));
  console.log(`\n[batch] Розгорнуто ${allExpanded.length} варіантів`);

  let t = Date.now();
  await preSeedAttributeLines(allExpanded);
  phase('Pre-seed атрибутів', t);

  // ── Phase 2: load existing BOMs ───────────────────────────────────────────
  t = Date.now();
  const existingBoms = await searchRead<{ id: number; code: string }>('mrp.bom', [], ['id', 'code']);
  const existingByCode = new Map(existingBoms.filter(b => b.code).map(b => [b.code, b.id]));
  phase(`Завантаження ${existingByCode.size} існуючих BOM`, t);

  // ── Phase 3: delete placeholder BOMs (for expanded entries) ───────────────
  for (const entry of boms) {
    if (entry.expand) {
      try { await deleteWrongBoms(entry.product.variantDisplayName); }
      catch (err: any) { console.warn(`  [WARN] Не вдалося видалити: ${err.message}`); }
    }
  }

  // ── Phase 4: resolve all new entries ──────────────────────────────────────
  t = Date.now();
  console.log(`\n[batch] Резолюція варіантів і компонентів...`);

  const toCreate: PreparedBom[] = [];
  let existedCount = 0;
  let skippedCount = 0;

  for (const entry of allExpanded) {
    if (existingByCode.has(entry.product.variantDisplayName)) {
      existedCount++;
      continue;
    }
    const prep = await resolveEntry(entry);
    if (prep) toCreate.push(prep);
    else skippedCount++;
  }

  phase(`Резолюція (${toCreate.length} нових, ${existedCount} існує, ${skippedCount} пропущено)`, t);

  if (toCreate.length === 0) {
    console.log(`\n[batch] Нічого нового для створення.`);
    console.log(`Загальний час: ${sec(totalStart)}`);
    return;
  }

  // ── Phase 5A: batch create BOMs ───────────────────────────────────────────
  t = Date.now();
  const bomData = toCreate.map(p => ({
    product_id: p.variantId,
    product_tmpl_id: p.templateId,
    code: p.bomCode,
    product_qty: p.qty,
    type: 'normal',
  }));
  const bomIds = await createMany('mrp.bom', bomData);
  phase(`Створення ${bomIds.length} BOM`, t);

  // ── Phase 5B: batch create operations ─────────────────────────────────────
  t = Date.now();
  const opRows: object[] = [];
  const opStartIdx: number[] = [];   // opStartIdx[i] = where toCreate[i]'s ops start in opRows

  for (let i = 0; i < toCreate.length; i++) {
    opStartIdx.push(opRows.length);
    for (const op of toCreate[i].operations) {
      opRows.push({
        name: op.name,
        bom_id: bomIds[i],
        workcenter_id: op.workcenterID,
        sequence: op.sequence,
        x_studio_piece_rate_2: op.priceRate,
      });
    }
  }

  let allOpIds: number[] = [];
  if (opRows.length > 0) {
    allOpIds = await createMany('mrp.routing.workcenter', opRows);
    phase(`Створення ${allOpIds.length} операцій`, t);
  }

  // ── Phase 5C: batch create BOM lines ──────────────────────────────────────
  t = Date.now();
  const lineRows: object[] = [];

  for (let i = 0; i < toCreate.length; i++) {
    const opBase = opStartIdx[i];
    const opCount = toCreate[i].operations.length;
    for (const comp of toCreate[i].components) {
      const opId = comp.operationIndex < opCount
        ? (allOpIds[opBase + comp.operationIndex] ?? false)
        : false;
      lineRows.push({
        bom_id: bomIds[i],
        product_id: comp.variantId,
        product_qty: comp.qty,
        product_uom_id: comp.uomId,
        sequence: comp.sequence,
        operation_id: opId,
      });
    }
  }

  if (lineRows.length > 0) {
    await createMany('mrp.bom.line', lineRows);
    phase(`Створення ${lineRows.length} рядків BOM`, t);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${LINE}`);
  console.log('ФАЗИ:');
  for (const p of phases) {
    console.log(`  ${(p.elapsed / 1000).toFixed(2)}s`.padEnd(10) + p.label);
  }
  console.log(LINE);
  console.log(`Підсумок: +${toCreate.length} створено  =${existedCount} існувало  ?${skippedCount} пропущено`);
  console.log(`Загальний час: ${sec(totalStart)}`);
  console.log(LINE);
}
