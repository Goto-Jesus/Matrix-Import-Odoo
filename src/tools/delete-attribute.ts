import { executeKw, unlink } from '../api/odoo';

const NO_MOVE_WH_IDS = [2, 3, 4, 5, 8, 10, 13, 15, 17, 18, 22, 24, 25, 29, 30, 31, 33, 23, 34];

async function main() {
  const ctx = { context: { active_test: false } };

  console.log(`Видалення ${NO_MOVE_WH_IDS.length} складів без stock moves...\n`);

  for (const whId of NO_MOVE_WH_IDS) {
    const whs = await executeKw<{ id: number; name: string }[]>(
      'stock.warehouse', 'search_read',
      [[['id', '=', whId]]],
      { fields: ['id', 'name'], ...ctx }
    );
    if (!whs.length) { console.log(`[${whId}] — не знайдено, пропускаю`); continue; }
    const name = whs[0].name;

    try {
      // 1. Picking types цього складу
      const ptIds: number[] = await executeKw<number[]>('stock.picking.type', 'search', [[['warehouse_id', '=', whId]]], ctx);

      // 2. Stock rules що посилаються на ці picking types
      if (ptIds.length > 0) {
        const ruleIds: number[] = await executeKw<number[]>('stock.rule', 'search', [[['picking_type_id', 'in', ptIds]]], ctx);
        if (ruleIds.length > 0) await unlink('stock.rule', ruleIds);

        // 3. Pickings (якщо є)
        const pickIds: number[] = await executeKw<number[]>('stock.picking', 'search', [[['picking_type_id', 'in', ptIds]]], ctx);
        if (pickIds.length > 0) await unlink('stock.picking', pickIds);
      }

      // 4. Routes складу
      const routeIds: number[] = await executeKw<number[]>(
        'stock.route', 'search',
        [['|', ['supplied_wh_id', '=', whId], ['supplier_wh_id', '=', whId]]], ctx
      );
      if (routeIds.length > 0) {
        // Видаляємо rules route-ів перед видаленням route
        const routeRuleIds: number[] = await executeKw<number[]>('stock.rule', 'search', [[['route_id', 'in', routeIds]]], ctx);
        if (routeRuleIds.length > 0) await unlink('stock.rule', routeRuleIds);
        await unlink('stock.route', routeIds);
      }

      // 5. Сам склад (cascade: picking types, locations)
      await unlink('stock.warehouse', [whId]);
      console.log(`  ✓ [${whId}] "${name}"`);
    } catch (e: any) {
      const msg = e.message?.replace(/\\n/g, ' ').slice(0, 200);
      console.log(`  ✗ [${whId}] "${name}" — ${msg}`);
    }
  }

  console.log('\n=== Готово ===');
}

main().catch(e => { console.error('\nПомилка:', e.message); process.exit(1); });
