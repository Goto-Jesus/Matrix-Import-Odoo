"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Diagnose a manufacturing order: show all BOM components and their routes.
 * Usage: ts-node src/tools/diagnose-mo.ts <product-name-search>
 * Example: ts-node src/tools/diagnose-mo.ts "Леон-Люкс 200 Механізм"
 */
const odoo_1 = require("../api/odoo");
async function main() {
    const search = process.argv[2] ?? '';
    await (0, odoo_1.authenticate)();
    // 1. Find the manufacturing order
    const mos = await (0, odoo_1.searchRead)('mrp.production', search ? [['product_id.name', 'ilike', search]] : [], ['id', 'name', 'product_id', 'state', 'move_raw_ids']);
    if (mos.length === 0) {
        console.log('Замовлення на виробництво не знайдено');
        return;
    }
    console.log(`\nЗнайдено MO: ${mos.length}`);
    for (const mo of mos) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`MO: ${mo.name}  [${mo.state}]`);
        console.log(`Продукт: ${mo.product_id[1]}`);
        // 2. Stock moves (raw materials / components)
        const moves = await (0, odoo_1.searchRead)('stock.move', [['id', 'in', mo.move_raw_ids]], ['id', 'product_id', 'product_qty', 'state']);
        console.log(`\nКомпоненти в МО (${moves.length}):`);
        for (const m of moves) {
            console.log(`  - ${m.product_id[1]}  qty:${m.product_qty}  [${m.state}]`);
        }
        // 3. Sub-manufacturing orders triggered
        const subMos = await (0, odoo_1.searchRead)('mrp.production', [['id', '!=', mo.id], ['product_id.name', 'ilike', '']], ['id', 'name', 'product_id', 'state']);
        // Actually look for sub-MOs linked to this MO via origin
        const linkedMos = await (0, odoo_1.searchRead)('mrp.production', [['origin', 'ilike', mo.name]], ['id', 'name', 'product_id', 'state', 'origin']);
        if (linkedMos.length > 0) {
            console.log(`\nПов'язані Sub-MO (${linkedMos.length}):`);
            for (const sub of linkedMos) {
                console.log(`  ✓ ${sub.name}: ${sub.product_id[1]}  [${sub.state}]`);
            }
        }
        else {
            console.log('\nSub-MO: не знайдено');
        }
    }
    // 4. Check BOM for the main product
    console.log(`\n${'='.repeat(70)}`);
    console.log('ПЕРЕВІРКА BOM і МАРШРУТІВ КОМПОНЕНТІВ');
    console.log('='.repeat(70));
    const boms = await (0, odoo_1.searchRead)('mrp.bom', [['product_tmpl_id.name', 'ilike', search]], ['id', 'product_tmpl_id', 'product_id', 'code', 'bom_line_ids']);
    console.log(`\nBOM для "${search}": ${boms.length} знайдено`);
    for (const bom of boms) {
        const variant = bom.product_id ? bom.product_id[1] : '(template-level)';
        console.log(`\n  BOM ${bom.id} [${bom.code ?? '—'}]: ${variant}`);
        const lines = await (0, odoo_1.searchRead)('mrp.bom.line', [['bom_id', '=', bom.id]], ['product_id', 'product_qty', 'bom_product_template_attribute_value_ids']);
        // Get route info for each unique component template
        const tmplIds = [...new Set(lines.map(l => l.product_id[0]))];
        const templates = await (0, odoo_1.searchRead)('product.product', [['id', 'in', tmplIds]], ['id', 'name', 'route_ids', 'type']);
        const tmplMap = new Map(templates.map(t => [t.id, t]));
        const routeNames = await (0, odoo_1.searchRead)('stock.route', [], ['id', 'name']);
        const routeMap = new Map(routeNames.map(r => [r.id, r.name]));
        console.log(`  Рядків BOM: ${lines.length}`);
        for (const line of lines) {
            const tmpl = tmplMap.get(line.product_id[0]);
            const routes = (tmpl?.route_ids ?? []).map(id => routeMap.get(id) ?? `#${id}`);
            const hasBom = '?'; // would need extra query
            const ptavCount = line.bom_product_template_attribute_value_ids.length;
            const filterTag = ptavCount > 0 ? `[filter:${ptavCount} PTAV]` : '[всі варіанти]';
            const routeTag = routes.length > 0 ? routes.join(' + ') : '❌ БЕЗ МАРШРУТУ';
            const typeTag = tmpl?.type ?? '?';
            console.log(`    ${line.product_id[1]} × ${line.product_qty}  ${filterTag}  route: ${routeTag}  type: ${typeTag}`);
        }
    }
}
main().catch(err => {
    console.error('[FATAL]', err.message);
    process.exit(1);
});
