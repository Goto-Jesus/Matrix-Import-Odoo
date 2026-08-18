"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const odoo_1 = require("../api/odoo");
function parseCehNumber(name) {
    // Matches: "Цех №7", "Цех №2-1", "Цех №10" — captures main цех number only
    const m = name.match(/[Цц]ех\s*[№#]?\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
}
function findRoute(routes, ...keywords) {
    return routes.find(r => keywords.some(kw => r.name.toLowerCase().includes(kw.toLowerCase())));
}
const isDryRun = !process.argv.includes('--apply');
async function run() {
    // 1. Available routes in Odoo
    const routes = await (0, odoo_1.searchRead)('stock.route', [], ['id', 'name']);
    console.log('\nДоступні маршрути в Odoo:');
    routes.forEach(r => console.log(`  ${r.id}: ${r.name}`));
    const mfgRoute = findRoute(routes, 'manufactur', 'виробн');
    // ВНЗ = Виготовлення На Замовлення (Make to Order in Ukrainian)
    const mtoRoute = findRoute(routes, 'внз', 'make to order', 'replenish on order', 'поповнит');
    if (!mfgRoute)
        throw new Error('Маршрут Manufacture не знайдено — перевір назви маршрутів вище');
    if (!mtoRoute)
        throw new Error('Маршрут MTO (ВНЗ) не знайдено — перевір назви маршрутів вище');
    console.log(`\n✓ Manufacture: "${mfgRoute.name}" (ID: ${mfgRoute.id})`);
    console.log(`✓ MTO (ВНЗ):   "${mtoRoute.name}" (ID: ${mtoRoute.id})`);
    // 2. Show all workcenters so we can diagnose naming convention
    const workcenters = await (0, odoo_1.searchRead)('mrp.workcenter', [], ['id', 'name']);
    console.log(`\nРобочі центри в Odoo (${workcenters.length}):`);
    for (const wc of workcenters) {
        const ceh = parseCehNumber(wc.name);
        const tag = ceh !== null ? ` → Цех ${ceh}` : ' → (не розпізнано)';
        console.log(`  ${wc.id}: ${wc.name}${tag}`);
    }
    // 4. BOM → template mapping
    const boms = await (0, odoo_1.searchRead)('mrp.bom', [], ['id', 'product_tmpl_id']);
    const bomToTmpl = new Map();
    for (const bom of boms)
        bomToTmpl.set(bom.id, bom.product_tmpl_id[0]);
    // 5. Operations → max цех number per template
    const ops = await (0, odoo_1.searchRead)('mrp.routing.workcenter', [], ['bom_id', 'workcenter_id']);
    const tmplMaxCeh = new Map();
    for (const op of ops) {
        const tmplId = bomToTmpl.get(op.bom_id[0]);
        if (!tmplId)
            continue;
        const ceh = parseCehNumber(op.workcenter_id[1]);
        if (ceh === null)
            continue;
        const prev = tmplMaxCeh.get(tmplId) ?? 0;
        if (ceh > prev)
            tmplMaxCeh.set(tmplId, ceh);
    }
    // 4. Load all templates that have BOMs
    const tmplIds = [...new Set(boms.map(b => b.product_tmpl_id[0]))];
    const templates = await (0, odoo_1.searchRead)('product.template', [['id', 'in', tmplIds]], ['id', 'name', 'route_ids']);
    // 5. Classify by max цех — for reporting only, ALL templates get Manufacture + MTO
    //    (потрібно для повного каскаду sub-MO Цех 1 → 9 з підтвердженого SO)
    const mtsTemplates = []; // цехи 1-6  (напівфабрикати)
    const mtoTemplates = []; // цехи 7-9  (фінальні вироби)
    const unknownTemplates = []; // немає операцій з відомим цехом
    for (const tmpl of templates) {
        const maxCeh = tmplMaxCeh.get(tmpl.id);
        if (maxCeh === undefined)
            unknownTemplates.push(tmpl);
        else if (maxCeh <= 6)
            mtsTemplates.push(tmpl);
        else
            mtoTemplates.push(tmpl);
    }
    // 6. Print classification
    const LINE = '='.repeat(60);
    console.log(`\n${LINE}`);
    console.log(`НАПІВФАБРИКАТИ — Цехи 1-6: ${mtsTemplates.length} шаблонів`);
    for (const t of mtsTemplates)
        console.log(`  - ${t.name}`);
    console.log(`\nФІНАЛЬНІ ВИРОБИ — Цехи 7+: ${mtoTemplates.length} шаблонів`);
    for (const t of mtoTemplates)
        console.log(`  - ${t.name}`);
    if (unknownTemplates.length > 0) {
        console.log(`\nБЕЗ ОПЕРАЦІЙ (цех не визначено): ${unknownTemplates.length} шаблонів`);
        for (const t of unknownTemplates)
            console.log(`  ? ${t.name}`);
    }
    const totalTemplates = mtsTemplates.length + mtoTemplates.length + unknownTemplates.length;
    console.log(`\n${LINE}`);
    console.log(`ВСЬОГО: ${totalTemplates} шаблонів → Manufacture + MTO`);
    console.log('(усі отримують обидва маршрути для повного каскаду MO Цех 1 → 9)');
    if (isDryRun) {
        console.log('DRY RUN — зміни не застосовано.');
        console.log('Додай --apply щоб встановити маршрути:');
        console.log('  npm run set-routes -- --apply');
        return;
    }
    // 7. Apply Manufacture + MTO to ALL templates with BOMs
    const allTemplates = [...mtsTemplates, ...mtoTemplates, ...unknownTemplates];
    if (allTemplates.length > 0) {
        await (0, odoo_1.write)('product.template', allTemplates.map(t => t.id), {
            route_ids: [[6, 0, [mfgRoute.id, mtoRoute.id]]],
        });
        console.log(`[+] Manufacture + MTO → ${allTemplates.length} шаблонів`);
    }
    console.log('\nМаршрути налаштовано!');
}
run().catch(err => {
    console.error('[FATAL]', err.message);
    process.exit(1);
});
