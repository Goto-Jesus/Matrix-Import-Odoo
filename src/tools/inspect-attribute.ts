import { executeKw, unlink } from '../api/odoo';

async function main() {
  const ctx = { context: { active_test: false } };
  const WH_ID = 2; // Цех ДСП №1

  // picking types
  const ptIds: number[] = await executeKw<number[]>('stock.picking.type', 'search', [[['warehouse_id', '=', WH_ID]]], ctx);
  console.log(`picking types: ${ptIds.length} — [${ptIds.join(', ')}]`);

  // pickings для цих типів
  const pickIds: number[] = await executeKw<number[]>('stock.picking', 'search', [[['picking_type_id', 'in', ptIds]]], ctx);
  console.log(`pickings: ${pickIds.length}`);

  // routes
  const routeIds: number[] = await executeKw<number[]>('stock.route', 'search', [[['supplied_wh_id', '=', WH_ID]]], ctx);
  console.log(`routes (supplied_wh_id): ${routeIds.length}`);

  const routeIds2: number[] = await executeKw<number[]>('stock.route', 'search', [[['supplier_wh_id', '=', WH_ID]]], ctx);
  console.log(`routes (supplier_wh_id): ${routeIds2.length}`);

  // locations
  const locIds: number[] = await executeKw<number[]>('stock.location', 'search', [[['warehouse_id', '=', WH_ID]]], ctx);
  console.log(`locations: ${locIds.length}`);

  // BOM що використовують route цього складу
  // Знаходимо route_ids складу
  const wh = await executeKw<{ id: number; name: string; route_ids: number[] }[]>(
    'stock.warehouse', 'search_read',
    [[['id', '=', WH_ID]]],
    { fields: ['id', 'name', 'route_ids'], ...ctx }
  );
  console.log(`\nСклад: ${JSON.stringify(wh[0])}`);

  // Спробуємо видалити і отримати повну помилку
  try {
    await unlink('stock.warehouse', [WH_ID]);
  } catch(e: any) {
    console.log(`\nПОВНА ПОМИЛКА:\n${e.message}`);
  }
}

main().catch(e => { console.error('Помилка:', e.message); process.exit(1); });
