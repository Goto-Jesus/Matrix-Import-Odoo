"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const odoo_1 = require("../api/odoo");
async function main() {
    const ctx = { context: { active_test: false } };
    const WH_ID = 2; // Цех ДСП №1
    // picking types
    const ptIds = await (0, odoo_1.executeKw)('stock.picking.type', 'search', [[['warehouse_id', '=', WH_ID]]], ctx);
    console.log(`picking types: ${ptIds.length} — [${ptIds.join(', ')}]`);
    // pickings для цих типів
    const pickIds = await (0, odoo_1.executeKw)('stock.picking', 'search', [[['picking_type_id', 'in', ptIds]]], ctx);
    console.log(`pickings: ${pickIds.length}`);
    // routes
    const routeIds = await (0, odoo_1.executeKw)('stock.route', 'search', [[['supplied_wh_id', '=', WH_ID]]], ctx);
    console.log(`routes (supplied_wh_id): ${routeIds.length}`);
    const routeIds2 = await (0, odoo_1.executeKw)('stock.route', 'search', [[['supplier_wh_id', '=', WH_ID]]], ctx);
    console.log(`routes (supplier_wh_id): ${routeIds2.length}`);
    // locations
    const locIds = await (0, odoo_1.executeKw)('stock.location', 'search', [[['warehouse_id', '=', WH_ID]]], ctx);
    console.log(`locations: ${locIds.length}`);
    // BOM що використовують route цього складу
    // Знаходимо route_ids складу
    const wh = await (0, odoo_1.executeKw)('stock.warehouse', 'search_read', [[['id', '=', WH_ID]]], { fields: ['id', 'name', 'route_ids'], ...ctx });
    console.log(`\nСклад: ${JSON.stringify(wh[0])}`);
    // Спробуємо видалити і отримати повну помилку
    try {
        await (0, odoo_1.unlink)('stock.warehouse', [WH_ID]);
    }
    catch (e) {
        console.log(`\nПОВНА ПОМИЛКА:\n${e.message}`);
    }
}
main().catch(e => { console.error('Помилка:', e.message); process.exit(1); });
