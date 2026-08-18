"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const odoo_1 = require("../api/odoo");
const NO_MOVE_WH_IDS = [2, 3, 4, 5, 8, 10, 13, 15, 17, 18, 22, 24, 25, 29, 30, 31, 33, 23, 34];
async function main() {
    const ctx = { context: { active_test: false } };
    console.log(`Видалення ${NO_MOVE_WH_IDS.length} складів без stock moves...\n`);
    for (const whId of NO_MOVE_WH_IDS) {
        const whs = await (0, odoo_1.executeKw)('stock.warehouse', 'search_read', [[['id', '=', whId]]], { fields: ['id', 'name'], ...ctx });
        if (!whs.length) {
            console.log(`[${whId}] — не знайдено, пропускаю`);
            continue;
        }
        const name = whs[0].name;
        try {
            // 1. Picking types цього складу
            const ptIds = await (0, odoo_1.executeKw)('stock.picking.type', 'search', [[['warehouse_id', '=', whId]]], ctx);
            // 2. Stock rules що посилаються на ці picking types
            if (ptIds.length > 0) {
                const ruleIds = await (0, odoo_1.executeKw)('stock.rule', 'search', [[['picking_type_id', 'in', ptIds]]], ctx);
                if (ruleIds.length > 0)
                    await (0, odoo_1.unlink)('stock.rule', ruleIds);
                // 3. Pickings (якщо є)
                const pickIds = await (0, odoo_1.executeKw)('stock.picking', 'search', [[['picking_type_id', 'in', ptIds]]], ctx);
                if (pickIds.length > 0)
                    await (0, odoo_1.unlink)('stock.picking', pickIds);
            }
            // 4. Routes складу
            const routeIds = await (0, odoo_1.executeKw)('stock.route', 'search', [['|', ['supplied_wh_id', '=', whId], ['supplier_wh_id', '=', whId]]], ctx);
            if (routeIds.length > 0) {
                // Видаляємо rules route-ів перед видаленням route
                const routeRuleIds = await (0, odoo_1.executeKw)('stock.rule', 'search', [[['route_id', 'in', routeIds]]], ctx);
                if (routeRuleIds.length > 0)
                    await (0, odoo_1.unlink)('stock.rule', routeRuleIds);
                await (0, odoo_1.unlink)('stock.route', routeIds);
            }
            // 5. Сам склад (cascade: picking types, locations)
            await (0, odoo_1.unlink)('stock.warehouse', [whId]);
            console.log(`  ✓ [${whId}] "${name}"`);
        }
        catch (e) {
            const msg = e.message?.replace(/\\n/g, ' ').slice(0, 200);
            console.log(`  ✗ [${whId}] "${name}" — ${msg}`);
        }
    }
    console.log('\n=== Готово ===');
}
main().catch(e => { console.error('\nПомилка:', e.message); process.exit(1); });
