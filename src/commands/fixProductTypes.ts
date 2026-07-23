/**
 * Bulk-fix sale_ok / purchase_ok on all product.template records based on their
 * role in the BOM tree in Odoo:
 *   - FINAL (has BOM, never used as component)  → sale_ok=true,  purchase_ok=false
 *   - SEMI  (has BOM, used as component)        → sale_ok=false, purchase_ok=false
 *   - RAW   (no BOM, only used as component)    → sale_ok=false, purchase_ok=true
 *
 * Services (type='service') and templates that are neither manufactured nor
 * components (leftover / manually created) are skipped — their flags stay.
 *
 * Dry-run by default; add --apply to write.
 */
import { authenticate, searchRead, write } from '../api/odoo';

interface Template {
  id: number;
  name: string;
  sale_ok: boolean;
  purchase_ok: boolean;
  type: string;
}

type CategoryKey = 'final' | 'semi' | 'raw';

const CATEGORIES: Record<CategoryKey, { sale_ok: boolean; purchase_ok: boolean; label: string }> = {
  final: { sale_ok: true,  purchase_ok: false, label: 'ФІНАЛЬНІ (продаж ✓ / закупка ✗)' },
  semi:  { sale_ok: false, purchase_ok: false, label: 'НАПІВФАБРИКАТИ (лише виробництво)' },
  raw:   { sale_ok: false, purchase_ok: true,  label: 'СИРОВИНА (закупка ✓ / продаж ✗)' },
};

/**
 * Substrings that STRONGLY indicate a template is semi-finished, even if the
 * DB has no consumer BOM referencing it (e.g. orphan of an incomplete import).
 * Overrides the "manufactured && no consumer → FINAL" default.
 */
const SEMI_NAME_INDICATORS = [
  '🪤', '🧩', '🪵', '🧽',     // emoji prefixes from documentation convention
  'напівфабрикат',
  'нарізан',                   // "нарізана деревина", "нарізані деталі", "нарізані матеріали"
];

function looksLikeSemi(name: string): boolean {
  return SEMI_NAME_INDICATORS.some(kw => name.includes(kw));
}

const isDryRun = !process.argv.includes('--apply');

function needsUpdate(t: Template, target: { sale_ok: boolean; purchase_ok: boolean }) {
  return t.sale_ok !== target.sale_ok || t.purchase_ok !== target.purchase_ok;
}

function flagStr(sale: boolean, purchase: boolean) {
  return `sale=${sale ? 'Y' : 'N'} purchase=${purchase ? 'Y' : 'N'}`;
}

async function run() {
  await authenticate();

  // 1. Manufactured templates: any template that has at least one BOM
  const boms = await searchRead<{ product_tmpl_id: [number, string] }>(
    'mrp.bom', [], ['product_tmpl_id'],
  );
  const manufacturedIds = new Set(boms.map(b => b.product_tmpl_id[0]));

  // 2. Component templates: bom.line.product_id → variant → template
  const bomLines = await searchRead<{ product_id: [number, string] }>(
    'mrp.bom.line', [], ['product_id'],
  );
  const componentVariantIds = [...new Set(bomLines.map(l => l.product_id[0]))];

  let componentTemplateIds = new Set<number>();
  if (componentVariantIds.length > 0) {
    const variants = await searchRead<{ id: number; product_tmpl_id: [number, string] }>(
      'product.product',
      [['id', 'in', componentVariantIds]],
      ['id', 'product_tmpl_id'],
    );
    componentTemplateIds = new Set(variants.map(v => v.product_tmpl_id[0]));
  }

  // 3. All templates
  const templates = await searchRead<Template>(
    'product.template', [], ['id', 'name', 'sale_ok', 'purchase_ok', 'type'],
  );

  // 4. Classify
  const groups: Record<CategoryKey, Template[]> = { final: [], semi: [], raw: [] };
  const skipped: Template[] = [];

  for (const t of templates) {
    if (t.type === 'service') { skipped.push(t); continue; }

    const isM = manufacturedIds.has(t.id);
    const isC = componentTemplateIds.has(t.id);

    // Manufactured + no consumer BOM → FINAL, UNLESS name signals semi-finished
    // (emoji prefix or "напівфабрикат"/"нарізан" substring). This guards against
    // orphan semi-finished from incomplete/older imports being flagged sellable.
    if (isM && !isC && !looksLikeSemi(t.name)) groups.final.push(t);
    else if (isM)                              groups.semi.push(t);
    else if (isC)                              groups.raw.push(t);
    else                                       skipped.push(t);
  }

  // 5. Print plan
  const LINE = '='.repeat(60);
  console.log(`\n${LINE}`);
  console.log(`ЗАВДАННЯ: масове виправлення sale_ok / purchase_ok`);
  console.log(`Всього шаблонів у product.template: ${templates.length}`);
  console.log(`BOM'ів у mrp.bom: ${boms.length}  |  унікальних компонентів: ${componentTemplateIds.size}`);
  console.log(LINE);

  const updatesByKey: Record<CategoryKey, Template[]> = { final: [], semi: [], raw: [] };
  let totalToUpdate = 0;

  for (const key of Object.keys(CATEGORIES) as CategoryKey[]) {
    const target = CATEGORIES[key];
    const list = groups[key];
    const toUpdate = list.filter(t => needsUpdate(t, target));
    updatesByKey[key] = toUpdate;
    totalToUpdate += toUpdate.length;

    const already = list.length - toUpdate.length;
    console.log(`\n[${key}] ${target.label}`);
    console.log(`  разом: ${list.length}  |  вже правильно: ${already}  |  до оновлення: ${toUpdate.length}`);

    for (const t of toUpdate) {
      const from = flagStr(t.sale_ok, t.purchase_ok);
      const to   = flagStr(target.sale_ok, target.purchase_ok);
      console.log(`    - ${t.name}   [${from} → ${to}]`);
    }
  }

  if (skipped.length > 0) {
    const services = skipped.filter(t => t.type === 'service').length;
    const other = skipped.length - services;
    console.log(`\n[skip] Пропущено: ${skipped.length}  (сервіси: ${services}, без BOM і не компонент: ${other})`);
  }

  console.log(`\n${LINE}`);
  console.log(`РАЗОМ до оновлення: ${totalToUpdate}`);
  console.log(LINE);

  if (totalToUpdate === 0) {
    console.log('Все вже правильно — жодних змін не потрібно.');
    return;
  }

  if (isDryRun) {
    console.log('DRY RUN — зміни не застосовано.');
    console.log('Щоб застосувати:');
    console.log('  npm run fix-product-types -- --apply');
    return;
  }

  // 6. Apply
  console.log('\nЗастосовую зміни...');
  for (const key of Object.keys(CATEGORIES) as CategoryKey[]) {
    const list = updatesByKey[key];
    if (list.length === 0) continue;
    const target = CATEGORIES[key];
    await write('product.template', list.map(t => t.id), {
      sale_ok: target.sale_ok,
      purchase_ok: target.purchase_ok,
    });
    console.log(`[+] ${key}: оновлено ${list.length}`);
  }

  console.log('\nГотово! Типи товарів виправлено.');
}

run().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
