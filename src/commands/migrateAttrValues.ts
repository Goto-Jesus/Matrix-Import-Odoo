import { searchRead, create } from '../api/odoo';

async function main() {
  const [, , sourceAttr, targetAttr] = process.argv;

  if (!sourceAttr || !targetAttr) {
    console.error('Використання: npm run migrate-attr "<джерело>" "<ціль>"');
    console.error('Наприклад:   npm run migrate-attr "Тканина" "Тканина_"');
    process.exit(1);
  }

  const attrs = await searchRead<any>(
    'product.attribute',
    [['name', 'in', [sourceAttr, targetAttr]]],
    ['id', 'name', 'value_ids']
  );

  const source = attrs.find((a: any) => a.name === sourceAttr);
  const target = attrs.find((a: any) => a.name === targetAttr);

  if (!source) throw new Error(`Атрибут "${sourceAttr}" не знайдено в Odoo`);
  if (!target) throw new Error(`Атрибут "${targetAttr}" не знайдено в Odoo`);

  console.log(`\n============================================================`);
  console.log(`Міграція значень: "${sourceAttr}" → "${targetAttr}"`);
  console.log(`============================================================\n`);
  console.log(`[OK] Джерело:  "${source.name}" (id: ${source.id}) — ${source.value_ids.length} значень`);
  console.log(`[OK] Ціль:     "${target.name}" (id: ${target.id}) — ${target.value_ids.length} існуючих значень\n`);

  const sourceValues = await searchRead<any>(
    'product.attribute.value',
    [['attribute_id', '=', source.id]],
    ['id', 'name']
  );

  const existingValues = await searchRead<any>(
    'product.attribute.value',
    [['attribute_id', '=', target.id]],
    ['id', 'name']
  );
  const existingNames = new Set(existingValues.map((v: any) => v.name));

  const toCreate = sourceValues.filter((v: any) => !existingNames.has(v.name));
  const skipped = sourceValues.filter((v: any) => existingNames.has(v.name));

  console.log(`Всього у джерелі: ${sourceValues.length}`);
  console.log(`Вже існують у цілі: ${skipped.length}`);
  console.log(`Треба створити: ${toCreate.length}\n`);

  if (toCreate.length === 0) {
    console.log('[OK] Нічого не треба переносити — всі значення вже є.');
    return;
  }

  let created = 0;
  let errors = 0;

  for (const val of toCreate) {
    try {
      await create('product.attribute.value', { name: val.name, attribute_id: target.id });
      console.log(`  [+] ${val.name}`);
      created++;
    } catch (err: any) {
      console.error(`  [!] Помилка для "${val.name}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n============================================================`);
  console.log(`ГОТОВО: створено ${created}, пропущено ${skipped.length}, помилок ${errors}`);
  console.log(`============================================================\n`);
}

main().catch(err => {
  console.error('\n[ПОМИЛКА]', err.message);
  process.exit(1);
});
