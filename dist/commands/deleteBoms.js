"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const odoo_1 = require("../api/odoo");
const KEYWORDS = process.argv.slice(2);
if (KEYWORDS.length === 0) {
    console.error('Usage: npx ts-node src/commands/deleteBoms.ts <keyword1> [keyword2] ...');
    console.error('Example: npx ts-node src/commands/deleteBoms.ts "Верадо" "Доррі"');
    process.exit(1);
}
async function run() {
    console.log(`Пошук BOM-ів за ключовими словами: ${KEYWORDS.join(', ')}\n`);
    const allBoms = await (0, odoo_1.searchRead)('mrp.bom', [], ['id', 'code', 'display_name']);
    const toDelete = allBoms.filter(b => b.code && KEYWORDS.some(kw => b.code.includes(kw)));
    if (toDelete.length === 0) {
        console.log('BOM-ів не знайдено.');
        return;
    }
    console.log(`Знайдено ${toDelete.length} BOM-ів для видалення:`);
    toDelete.forEach(b => console.log(`  [${b.id}] ${b.code}`));
    console.log(`\nВидалення...`);
    await (0, odoo_1.unlink)('mrp.bom', toDelete.map(b => b.id));
    console.log(`Видалено ${toDelete.length} BOM-ів.`);
}
run().catch((err) => {
    console.error('[FATAL]', err.message);
    process.exit(1);
});
