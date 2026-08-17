import { searchRead, create, write, executeKw, authenticate } from '../api/odoo';

const FABRIC_ATTR_NAME = 'Тканина';

interface AttrLine {
  id: number;
  product_tmpl_id: [number, string];
  value_ids: number[];
}

interface BomLine {
  id: number;
  product_id: [number, string];
  product_qty: number;
  product_uom_id: [number, string];
  operation_id: [number, string] | false;
  sequence: number;
  bom_product_template_attribute_value_ids: number[];
}

export async function runAddFabric(newFabricName: string): Promise<void> {
  await authenticate();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`ADD FABRIC: "${newFabricName}"`);
  console.log('='.repeat(60));

  // ── 1. Find "Тканина" attribute ──────────────────────────────────
  const [fabricAttr] = await searchRead<{ id: number }>(
    'product.attribute', [['name', '=', FABRIC_ATTR_NAME]], ['id'], 1
  );
  if (!fabricAttr) throw new Error(`Атрибут "${FABRIC_ATTR_NAME}" не знайдено в Odoo`);
  const fabricAttrId = fabricAttr.id;
  console.log(`\n[1] Атрибут "${FABRIC_ATTR_NAME}" (ID: ${fabricAttrId})`);

  // ── 2. Create or find new fabric value ───────────────────────────
  const [existingVal] = await searchRead<{ id: number }>(
    'product.attribute.value',
    [['attribute_id', '=', fabricAttrId], ['name', '=', newFabricName]],
    ['id'], 1
  );
  let newFabricValueId: number;
  if (existingVal) {
    newFabricValueId = existingVal.id;
    console.log(`[2] Значення "${newFabricName}" вже існує (ID: ${newFabricValueId})`);
  } else {
    newFabricValueId = await create('product.attribute.value', {
      attribute_id: fabricAttrId,
      name: newFabricName,
    });
    console.log(`[2] Створено значення "${newFabricName}" (ID: ${newFabricValueId})`);
  }

  // ── 3. Add new value to every template that has "Тканина" ────────
  const attrLines = await searchRead<AttrLine>(
    'product.template.attribute.line',
    [['attribute_id', '=', fabricAttrId]],
    ['id', 'product_tmpl_id', 'value_ids']
  );
  console.log(`\n[3] Шаблонів з атрибутом "${FABRIC_ATTR_NAME}": ${attrLines.length}`);

  const templateIds: number[] = [];
  for (const line of attrLines) {
    const [tmplId, tmplName] = line.product_tmpl_id;
    templateIds.push(tmplId);
    if (line.value_ids.includes(newFabricValueId)) {
      console.log(`  [=] "${tmplName}" — вже є`);
      continue;
    }
    await write('product.template.attribute.line', [line.id], {
      value_ids: [[4, newFabricValueId]],
    });
    console.log(`  [+] "${tmplName}"`);
  }

  // ── 4. Load new PTAV IDs (Odoo creates them when value is added) ─
  const newPtavRecords = await searchRead<{ id: number; product_tmpl_id: [number, string] }>(
    'product.template.attribute.value',
    [
      ['product_tmpl_id', 'in', templateIds],
      ['attribute_id', '=', fabricAttrId],
      ['name', '=', newFabricName],
    ],
    ['id', 'product_tmpl_id']
  );
  const tmplToNewPtav = new Map<number, number>(
    newPtavRecords.map(p => [p.product_tmpl_id[0], p.id])
  );
  console.log(`\n[4] Нові PTAV: ${newPtavRecords.length}/${templateIds.length} шаблонів`);

  // ── 5. Load ALL fabric PTAVs per template (to identify BOM lines) ─
  const allFabricPtavRecords = await searchRead<{ id: number; product_tmpl_id: [number, string] }>(
    'product.template.attribute.value',
    [['product_tmpl_id', 'in', templateIds], ['attribute_id', '=', fabricAttrId]],
    ['id', 'product_tmpl_id']
  );
  const tmplFabricPtavs = new Map<number, Set<number>>();
  for (const p of allFabricPtavRecords) {
    const tid = p.product_tmpl_id[0];
    if (!tmplFabricPtavs.has(tid)) tmplFabricPtavs.set(tid, new Set());
    tmplFabricPtavs.get(tid)!.add(p.id);
  }

  // ── 6. Find all template-level BOMs for fabric templates ─────────
  const tplBoms = await searchRead<{ id: number; product_tmpl_id: [number, string] }>(
    'mrp.bom',
    [['product_tmpl_id', 'in', templateIds], ['product_id', '=', false]],
    ['id', 'product_tmpl_id']
  );
  console.log(`\n[5] Template BOMs з тканиною: ${tplBoms.length}`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const bom of tplBoms) {
    const [tmplId, tmplName] = bom.product_tmpl_id;
    const newPtavId = tmplToNewPtav.get(tmplId);
    if (!newPtavId) {
      console.warn(`  [WARN] Немає нового PTAV для "${tmplName}" — пропуск`);
      continue;
    }

    const fabricPtavSet = tmplFabricPtavs.get(tmplId) ?? new Set<number>();

    const lines = await searchRead<BomLine>(
      'mrp.bom.line',
      [['bom_id', '=', bom.id]],
      ['id', 'product_id', 'product_qty', 'product_uom_id', 'operation_id', 'sequence',
        'bom_product_template_attribute_value_ids']
    );

    // Lines filtered by an existing (non-new) fabric PTAV
    const fabricLines = lines.filter(l =>
      l.bom_product_template_attribute_value_ids.some(
        pid => fabricPtavSet.has(pid) && pid !== newPtavId
      )
    );
    if (fabricLines.length === 0) continue;

    // Batch-load component template IDs
    const compVariantIds = [...new Set(fabricLines.map(l => l.product_id[0]))];
    const compVariants = await executeKw<{ id: number; product_tmpl_id: number }[]>(
      'product.product', 'read', [compVariantIds], { fields: ['id', 'product_tmpl_id'] }
    );
    const variantToTmpl = new Map<number, number>(compVariants.map(v => [v.id, v.product_tmpl_id]));

    // Deduplicate: group by (compTmplId, non-fabric PTAVs, qty, uom, operation)
    const seen = new Map<string, BomLine>();
    for (const line of fabricLines) {
      const compTmplId = variantToTmpl.get(line.product_id[0]) ?? line.product_id[0];
      const otherPtavs = line.bom_product_template_attribute_value_ids
        .filter(pid => !fabricPtavSet.has(pid))
        .sort()
        .join(',');
      const opId = line.operation_id ? line.operation_id[0] : 0;
      const key = `${compTmplId}::${line.product_qty}::${line.product_uom_id[0]}::${opId}::${otherPtavs}`;
      if (!seen.has(key)) seen.set(key, line);
    }

    const maxSeq = Math.max(...lines.map(l => l.sequence), 0);
    let nextSeq = maxSeq + 1;

    console.log(`\n  [bom] "${tmplName}" — ${seen.size} рядків`);

    for (const [, patternLine] of seen) {
      const compVariantId = patternLine.product_id[0];
      const compTmplId = variantToTmpl.get(compVariantId)!;
      const compHasFabric = tmplToNewPtav.has(compTmplId);

      let newCompVariantId = compVariantId;

      if (compHasFabric) {
        const compNewPtavId = tmplToNewPtav.get(compTmplId)!;
        const compFabricPtavs = tmplFabricPtavs.get(compTmplId) ?? new Set<number>();

        const [oldVariant] = await searchRead<{ id: number; product_template_attribute_value_ids: number[] }>(
          'product.product', [['id', '=', compVariantId]],
          ['id', 'product_template_attribute_value_ids'], 1
        );
        if (!oldVariant) {
          console.warn(`    [WARN] Варіант ${compVariantId} не знайдено`);
          continue;
        }

        const nonFabricPtavs = oldVariant.product_template_attribute_value_ids
          .filter(pid => !compFabricPtavs.has(pid));
        const desiredPtavSet = new Set([...nonFabricPtavs, compNewPtavId]);

        const candidates = await searchRead<{ id: number; product_template_attribute_value_ids: number[] }>(
          'product.product',
          [['product_tmpl_id', '=', compTmplId]],
          ['id', 'product_template_attribute_value_ids']
        );
        const match = candidates.find(v => {
          const s = new Set(v.product_template_attribute_value_ids);
          return s.size === desiredPtavSet.size && [...desiredPtavSet].every(pid => s.has(pid));
        });
        if (!match) {
          console.warn(`    [WARN] Варіант не знайдено: ${patternLine.product_id[1]} / ${newFabricName}`);
          continue;
        }
        newCompVariantId = match.id;
      }

      // Replace all fabric PTAVs in the filter with the new one
      const newPtavFilter = [
        ...patternLine.bom_product_template_attribute_value_ids.filter(pid => !fabricPtavSet.has(pid)),
        newPtavId,
      ];

      // Skip if line already exists
      const alreadyExists = lines.some(l => {
        if (l.product_id[0] !== newCompVariantId) return false;
        const s = new Set(l.bom_product_template_attribute_value_ids);
        return newPtavFilter.length === s.size && newPtavFilter.every(pid => s.has(pid));
      });
      if (alreadyExists) {
        totalSkipped++;
        continue;
      }

      await create('mrp.bom.line', {
        bom_id: bom.id,
        product_id: newCompVariantId,
        product_qty: patternLine.product_qty,
        product_uom_id: patternLine.product_uom_id[0],
        operation_id: patternLine.operation_id ? patternLine.operation_id[0] : false,
        sequence: nextSeq++,
        bom_product_template_attribute_value_ids: [[6, 0, newPtavFilter]],
      });

      totalCreated++;
      console.log(`    [+] ${patternLine.product_id[1]}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Готово: +${totalCreated} рядків BOM  (=${totalSkipped} вже існувало)`);
  console.log('='.repeat(60));
}

async function main(): Promise<void> {
  const fabricName = process.argv[2];
  if (!fabricName) {
    console.error('Usage: ts-node src/commands/addFabric.ts "Назва тканини"');
    console.error('Example: ts-node src/commands/addFabric.ts "Велюр Темно-синій"');
    process.exit(1);
  }
  await runAddFabric(fabricName);
}

if (typeof require !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error("[FATAL]", err.message);
    process.exit(1);
  });
}
