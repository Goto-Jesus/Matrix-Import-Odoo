"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const odoo_1 = require("../api/odoo");
const OLD_ATTR_NAMES = ['Модель', 'Тканина', 'Диван Пружинний Блок', 'Диван Наповнювач Подушек', 'Диван Розмір Бильця', 'ДВП дно'];
async function main() {
    const attrs = await (0, odoo_1.searchRead)('product.attribute', [['name', 'in', OLD_ATTR_NAMES]], ['id', 'name', 'create_variant']);
    const newAttrs = await (0, odoo_1.searchRead)('product.attribute', [['name', 'in', OLD_ATTR_NAMES.map(n => n + '_')]], ['id', 'name', 'create_variant']);
    console.log('\n=== СТАРІ АТРИБУТИ ===');
    attrs.forEach((a) => console.log(`  [${a.id}] ${a.name} | ${a.create_variant}`));
    console.log('\n=== НОВІ АТРИБУТИ ===');
    newAttrs.forEach((a) => console.log(`  [${a.id}] ${a.name} | ${a.create_variant}`));
    const oldAttrIds = attrs.map((a) => a.id);
    const ptalLines = await (0, odoo_1.searchRead)('product.template.attribute.line', [['attribute_id', 'in', oldAttrIds]], ['id', 'product_tmpl_id', 'attribute_id', 'value_ids']);
    console.log(`\nPTAL рядків зі старими атрибутами: ${ptalLines.length}`);
    const byTemplate = {};
    ptalLines.forEach((l) => {
        const tid = l.product_tmpl_id[0];
        if (!byTemplate[tid])
            byTemplate[tid] = { name: l.product_tmpl_id[1], attrs: [] };
        byTemplate[tid].attrs.push(`${l.attribute_id[1]} (${l.value_ids.length} знач.)`);
    });
    console.log('\n=== Шаблони зі старими атрибутами ===');
    Object.entries(byTemplate).forEach(([tid, info]) => {
        console.log(`  [${tid}] ${info.name}`);
        info.attrs.forEach(a => console.log(`       - ${a}`));
    });
    // BOMs що мають product_id
    const boms = await (0, odoo_1.searchRead)('mrp.bom', [], ['id', 'product_tmpl_id', 'product_id', 'code']);
    const bomsWithVariant = boms.filter((b) => b.product_id && b.product_id !== false);
    console.log(`\n=== BOMs ===`);
    console.log(`Всього BOMs: ${boms.length}`);
    console.log(`З конкретним варіантом (product_id): ${bomsWithVariant.length}`);
    console.log(`Тільки по шаблону: ${boms.length - bomsWithVariant.length}`);
    // Перевіримо варіанти що задіяні в BOMs — які мають атрибути що мігруємо
    const variantIds = bomsWithVariant.map((b) => b.product_id[0]);
    const variants = await (0, odoo_1.searchRead)('product.product', [['id', 'in', variantIds]], ['id', 'display_name', 'product_tmpl_id', 'product_template_attribute_value_ids']);
    // Отримаємо PTAV (product.template.attribute.value) для цих варіантів
    const ptavIds = [...new Set(variants.flatMap((v) => v.product_template_attribute_value_ids))];
    const ptavs = await (0, odoo_1.searchRead)('product.template.attribute.value', [['id', 'in', ptavIds]], ['id', 'attribute_id', 'product_attribute_value_id', 'name']);
    const ptavById = Object.fromEntries(ptavs.map((p) => [p.id, p]));
    console.log(`\n=== ПРИКЛАД: перші 5 BOMs варіантів з атрибутами ===`);
    bomsWithVariant.slice(0, 5).forEach((bom) => {
        const v = variants.find((x) => x.id === bom.product_id[0]);
        if (!v)
            return;
        const attrVals = v.product_template_attribute_value_ids.map((pid) => {
            const p = ptavById[pid];
            return p ? `${p.attribute_id[1]}=${p.name}` : `?`;
        });
        console.log(`  BOM[${bom.id}] ${v.display_name}`);
        console.log(`    Атрибути: ${attrVals.join(', ') || 'none'}`);
    });
}
main().catch(err => { console.error('\n[ПОМИЛКА]', err.message); process.exit(1); });
