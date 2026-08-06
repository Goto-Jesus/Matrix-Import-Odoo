/**
 * Два звіти:
 *  1. Товари БЕЗ категорії (або з "All") + до якого дивану відносяться
 *  2. Товари що ПОМИЛКОВО потрапили до "Готова продукція / Дивани"
 *     (лише назви "Диван ..." мають там бути)
 * Результати зберігаються у папку no_category/
 */
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, searchRead } from '../api/odoo';

interface ProductTemplate {
  id: number;
  name: string;
  categ_id: [number, string] | false;
  type: string;
  sale_ok: boolean;
  purchase_ok: boolean;
}

interface BomLine {
  id: number;
  bom_id: [number, string];
  product_id: [number, string];
  product_tmpl_id: [number, string];
}

interface Bom {
  id: number;
  product_tmpl_id: [number, string];
  code: string | false;
  type: string;
}

interface NoCategoryProduct {
  id: number;
  name: string;
  currentCategory: string;
  type: string;
  sale_ok: boolean;
  purchase_ok: boolean;
  usedInBoms: Array<{ bomId: number; bomCode: string; parentTemplate: string }>;
  belongsToSofas: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Причини чому товар міг потрапити до "Готова продукція / Дивани"
// ─────────────────────────────────────────────────────────────────────────────
type WrongReason =
  | 'service_no_is_service_flag'    // service тип, але isService не було виставлено в JSON
  | 'semi_finished_as_final'        // напівфабрикат (є і в manufactured і в componentNames)
  | 'raw_material_as_final'         // сировина (тільки компонент)
  | 'name_not_sofa'                 // назва не починається з "Диван"
  | 'has_own_bom_component_too'     // є BOM, але також є компонентом у вищих BOM
  | 'unknown';

interface WrongInFinalProduct {
  id: number;
  name: string;
  type: string;
  sale_ok: boolean;
  purchase_ok: boolean;
  hasOwnBom: boolean;
  ownBomIds: number[];
  usedAsComponentIn: Array<{ bomId: number; bomCode: string; parentTemplate: string }>;
  reasons: WrongReason[];
  reasonExplanations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

async function findParentSofas(
  templateId: number,
  allBomLines: BomLine[],
  bomById: Map<number, Bom>,
  visited: Set<number> = new Set()
): Promise<string[]> {
  if (visited.has(templateId)) return [];
  visited.add(templateId);

  const parentBomIds = allBomLines
    .filter(line => line.product_tmpl_id[0] === templateId)
    .map(line => line.bom_id[0]);

  if (parentBomIds.length === 0) return [];

  const sofas: string[] = [];
  for (const bomId of [...new Set(parentBomIds)]) {
    const bom = bomById.get(bomId);
    if (!bom) continue;
    const parentName = bom.product_tmpl_id[1];
    if (parentName.startsWith('Диван')) {
      if (!sofas.includes(parentName)) sofas.push(parentName);
    } else {
      const upper = await findParentSofas(bom.product_tmpl_id[0], allBomLines, bomById, visited);
      for (const s of upper) if (!sofas.includes(s)) sofas.push(s);
    }
  }
  return sofas;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await authenticate();

  const outputDir = path.resolve('no_category');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // ── Загальні дані ──────────────────────────────────────────────────────────

  console.log('\n[1/6] Категорії...');
  const allCategories = await searchRead<{ id: number; complete_name: string }>(
    'product.category', [], ['id', 'complete_name']
  );
  const catIdByName = new Map(allCategories.map(c => [c.complete_name, c.id]));

  const defaultCatIds = new Set(
    allCategories
      .filter(c => c.complete_name === 'All' || c.complete_name === 'Всі' || c.complete_name === 'all')
      .map(c => c.id)
  );
  const finalCatId = catIdByName.get('Готова продукція / Дивани');
  if (!finalCatId) {
    console.error('[ERROR] Категорію "Готова продукція / Дивани" не знайдено в Odoo!');
    process.exit(1);
  }
  console.log(`   Default root cat IDs: [${[...defaultCatIds].join(', ')}]`);
  console.log(`   "Готова продукція / Дивани" ID: ${finalCatId}`);

  console.log('\n[2/6] Шаблони товарів...');
  const allTemplates = await searchRead<ProductTemplate>(
    'product.template', [],
    ['id', 'name', 'categ_id', 'type', 'sale_ok', 'purchase_ok']
  );
  console.log(`   Всього: ${allTemplates.length}`);

  console.log('\n[3/6] BOM...');
  const allBoms = await searchRead<Bom>(
    'mrp.bom', [], ['id', 'product_tmpl_id', 'code', 'type']
  );
  const bomById = new Map(allBoms.map(b => [b.id, b]));
  // Множина templateId-шаблонів що МАЮТЬ власний BOM
  const templateIdsWithBom = new Set(allBoms.map(b => b.product_tmpl_id[0]));
  console.log(`   Всього BOM: ${allBoms.length}`);

  console.log('\n[4/6] BOM-рядки (компоненти)...');
  const allBomLines = await searchRead<BomLine>(
    'mrp.bom.line', [], ['id', 'bom_id', 'product_id', 'product_tmpl_id']
  );
  // Множина templateId-шаблонів що є КОМПОНЕНТОМ у якомусь BOM
  const templateIdsUsedAsComponent = new Set(allBomLines.map(l => l.product_tmpl_id[0]));
  console.log(`   Всього рядків: ${allBomLines.length}`);

  // ── ЗВІТ 1: Товари без категорії ──────────────────────────────────────────

  console.log('\n[5/6] Аналіз товарів без категорії...');
  const noCategory = allTemplates.filter(t =>
    !t.categ_id || defaultCatIds.has(t.categ_id[0])
  );
  console.log(`   Без категорії: ${noCategory.length}`);

  const noCatResults: NoCategoryProduct[] = [];
  for (let i = 0; i < noCategory.length; i++) {
    const t = noCategory[i];
    if (i % 10 === 0) process.stdout.write(`\r   ${i + 1}/${noCategory.length}...`);

    const linesForTemplate = allBomLines.filter(l => l.product_tmpl_id[0] === t.id);
    const usedInBomIds = [...new Set(linesForTemplate.map(l => l.bom_id[0]))];
    const usedInBoms = usedInBomIds
      .map(bomId => {
        const bom = bomById.get(bomId);
        return bom ? { bomId, bomCode: bom.code || '', parentTemplate: bom.product_tmpl_id[1] } : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    const sofas = await findParentSofas(t.id, allBomLines, bomById, new Set());

    noCatResults.push({
      id: t.id,
      name: t.name,
      currentCategory: t.categ_id ? t.categ_id[1] : 'немає',
      type: t.type,
      sale_ok: t.sale_ok,
      purchase_ok: t.purchase_ok,
      usedInBoms,
      belongsToSofas: sofas,
    });
  }
  process.stdout.write('\n');

  // Групуємо по диванах
  const bySofa = new Map<string, NoCategoryProduct[]>();
  const noSofa: NoCategoryProduct[] = [];
  for (const p of noCatResults) {
    if (p.belongsToSofas.length === 0) {
      noSofa.push(p);
    } else {
      for (const sofa of p.belongsToSofas) {
        if (!bySofa.has(sofa)) bySofa.set(sofa, []);
        bySofa.get(sofa)!.push(p);
      }
    }
  }

  fs.writeFileSync(
    path.join(outputDir, 'all_no_category.json'),
    JSON.stringify(noCatResults, null, 2), 'utf-8'
  );
  for (const [sofaName, products] of bySofa) {
    const safeName = sofaName.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 80);
    fs.writeFileSync(
      path.join(outputDir, `sofa_${safeName}.json`),
      JSON.stringify({ sofa: sofaName, count: products.length, products }, null, 2), 'utf-8'
    );
  }
  if (noSofa.length > 0) {
    fs.writeFileSync(
      path.join(outputDir, 'no_sofa_link.json'),
      JSON.stringify({ count: noSofa.length, products: noSofa }, null, 2), 'utf-8'
    );
  }

  // ── ЗВІТ 2: Помилки в "Готова продукція / Дивани" ─────────────────────────

  console.log('\n[6/6] Аналіз "Готова продукція / Дивани"...');
  const inFinalCat = allTemplates.filter(t => t.categ_id && t.categ_id[0] === finalCatId);
  console.log(`   В категорії: ${inFinalCat.length}`);

  const correctInFinal = inFinalCat.filter(t => t.name.startsWith('Диван'));
  const wrongInFinal   = inFinalCat.filter(t => !t.name.startsWith('Диван'));
  console.log(`   Правильних (Диван ...): ${correctInFinal.length}`);
  console.log(`   ЗАЙВИХ (не починається з "Диван"): ${wrongInFinal.length}`);

  const wrongResults: WrongInFinalProduct[] = [];

  for (const t of wrongInFinal) {
    const ownBomIds = allBoms.filter(b => b.product_tmpl_id[0] === t.id).map(b => b.id);
    const hasOwnBom = ownBomIds.length > 0;

    const isManufactured = templateIdsWithBom.has(t.id);
    const isComponent    = templateIdsUsedAsComponent.has(t.id);

    const linesForTemplate = allBomLines.filter(l => l.product_tmpl_id[0] === t.id);
    const usedAsComponentIn = [...new Set(linesForTemplate.map(l => l.bom_id[0]))]
      .map(bomId => {
        const bom = bomById.get(bomId);
        return bom ? { bomId, bomCode: bom.code || '', parentTemplate: bom.product_tmpl_id[1] } : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    const reasons: WrongReason[]  = [];
    const explanations: string[]  = [];

    // Назва не починається з "Диван" — головна причина
    reasons.push('name_not_sofa');
    explanations.push(`Назва "${t.name}" не починається з "Диван" — не є готовим диваном`);

    if (t.type === 'service') {
      reasons.push('service_no_is_service_flag');
      explanations.push(
        'Тип = service. Імовірно, у JSON-файлі comp.isService не було виставлено true, ' +
        'тому applyProductCategories не пропустив цей товар і призначив категорію помилково'
      );
    } else if (isManufactured && isComponent) {
      reasons.push('semi_finished_as_final');
      explanations.push(
        'Напівфабрикат: має власний BOM (виробляється) і водночас є компонентом у вищих BOM. ' +
        'applyProductCategories мала призначити категорію Цех№, але щось пішло не так ' +
        '(відсутній workcenter або token Цех не розпізнано)'
      );
    } else if (!isManufactured && isComponent) {
      reasons.push('raw_material_as_final');
      explanations.push(
        'Сировина / компонент без власного BOM — не виробляється самостійно. ' +
        'Потрапив до "Готова продукція" через помилку класифікації: ' +
        'можливо, у JSON він фігурував як product.templateName (виробник), ' +
        'хоча насправді є лише компонентом'
      );
    } else if (isManufactured && !isComponent) {
      // Є BOM, не є компонентом — технічно "фінальний", але назва не "Диван"
      reasons.push('has_own_bom_component_too');
      explanations.push(
        'Має власний BOM і не є компонентом у жодному вищому BOM — ' +
        'логіка вважає його "фінальним продуктом", але назва не відповідає шаблону "Диван ..."'
      );
    }

    wrongResults.push({
      id: t.id,
      name: t.name,
      type: t.type,
      sale_ok: t.sale_ok,
      purchase_ok: t.purchase_ok,
      hasOwnBom,
      ownBomIds,
      usedAsComponentIn,
      reasons,
      reasonExplanations: explanations,
    });
  }

  // Групуємо по причинах для summary
  const byReason = new Map<WrongReason, WrongInFinalProduct[]>();
  for (const p of wrongResults) {
    for (const r of p.reasons) {
      if (!byReason.has(r)) byReason.set(r, []);
      byReason.get(r)!.push(p);
    }
  }

  fs.writeFileSync(
    path.join(outputDir, 'wrong_in_final_category.json'),
    JSON.stringify({
      category: 'Готова продукція / Дивани',
      totalInCategory: inFinalCat.length,
      correctCount: correctInFinal.length,
      wrongCount: wrongResults.length,
      byReason: Object.fromEntries(
        [...byReason.entries()].map(([r, items]) => [r, items.map(i => i.name)])
      ),
      products: wrongResults,
    }, null, 2),
    'utf-8'
  );

  // ── Summary ────────────────────────────────────────────────────────────────

  const summaryPath = path.join(outputDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    totalTemplates: allTemplates.length,
    report1_noCategory: {
      count: noCatResults.length,
      sofaGroups: [...bySofa.entries()].map(([sofa, prods]) => ({
        sofa, count: prods.length, products: prods.map(p => p.name),
      })),
      noSofaLink: noSofa.map(p => p.name),
    },
    report2_wrongInFinalCat: {
      categoryId: finalCatId,
      totalInCategory: inFinalCat.length,
      correctCount: correctInFinal.length,
      wrongCount: wrongResults.length,
      byReason: Object.fromEntries(
        [...byReason.entries()].map(([r, items]) => [r, items.map(i => i.name)])
      ),
    },
  }, null, 2), 'utf-8');

  // ── Вивід у термінал ───────────────────────────────────────────────────────

  console.log(`\n${'='.repeat(60)}`);
  console.log('ЗВІТ 1: ТОВАРИ БЕЗ КАТЕГОРІЇ');
  console.log('='.repeat(60));
  console.log(`Всього без категорії: ${noCatResults.length} з ${allTemplates.length}`);
  for (const [sofa, prods] of [...bySofa.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${sofa}: ${prods.length} товарів`);
  }
  if (noSofa.length > 0) {
    console.log(`\n  Без прив'язки до дивану: ${noSofa.length}`);
    for (const p of noSofa) console.log(`    - ${p.name} [${p.type}]`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('ЗВІТ 2: ЗАЙВІ ТОВАРИ В "Готова продукція / Дивани"');
  console.log('='.repeat(60));
  console.log(`В категорії всього: ${inFinalCat.length}  |  Правильних: ${correctInFinal.length}  |  ЗАЙВИХ: ${wrongResults.length}`);
  if (wrongResults.length > 0) {
    console.log('');
    for (const p of wrongResults) {
      console.log(`  [${p.type}] ${p.name}`);
      for (const ex of p.reasonExplanations) console.log(`    → ${ex}`);
    }
  }

  console.log(`\nФайли збережено у: ${path.resolve(outputDir)}`);
  console.log(`  - all_no_category.json`);
  console.log(`  - wrong_in_final_category.json`);
  console.log(`  - summary.json`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
