import { searchRead, unlink } from '../api/odoo';

const KEYWORDS = process.argv.slice(2);
if (KEYWORDS.length === 0) {
  console.error('Usage: npx ts-node src/commands/deleteBoms.ts <keyword1> [keyword2] ...');
  console.error('Example: npx ts-node src/commands/deleteBoms.ts "Верадо" "Доррі"');
  process.exit(1);
}

async function run(): Promise<void> {
  console.log(`Пошук BOM-ів за ключовими словами: ${KEYWORDS.join(', ')}\n`);

  const allBoms = await searchRead<{ id: number; code: string; display_name: string }>(
    'mrp.bom', [], ['id', 'code', 'display_name']
  );

  const toDelete = allBoms.filter(b =>
    b.code && KEYWORDS.some(kw => b.code.includes(kw))
  );

  if (toDelete.length === 0) {
    console.log('BOM-ів не знайдено.');
    return;
  }

  console.log(`Знайдено ${toDelete.length} BOM-ів для видалення:`);
  toDelete.forEach(b => console.log(`  [${b.id}] ${b.code}`));

  console.log(`\nВидалення...`);
  await unlink('mrp.bom', toDelete.map(b => b.id));
  console.log(`Видалено ${toDelete.length} BOM-ів.`);
}

run().catch((err: Error) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
