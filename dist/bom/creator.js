"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBom = createBom;
exports.createAllBoms = createAllBoms;
const odoo_1 = require("../api/odoo");
const product_1 = require("./product");
function bomLabel(def) {
    return def.variants?.length
        ? `${def.product} (${def.variants.join(', ')})`
        : def.product;
}
/**
 * Створити одну специфікацію (BOM) з операціями та компонентами.
 *
 * Якщо BOM вже існує (за product_id + code) — повертає існуючий ID.
 * Компоненти з operationIndex прив'язуються до відповідної операції
 * (поле "Спожитий в операції" / operation_id у mrp.bom.line).
 */
async function createBom(def) {
    const label = bomLabel(def);
    const reference = def.reference ?? def.variants?.join(' / ') ?? '';
    // 1. Знайти вихідний варіант товару
    const resolved = await (0, product_1.resolveProduct)(def.product, def.variants);
    if (!resolved) {
        console.warn(`  [SKIP] Не вдалося знайти товар: ${label}`);
        return null;
    }
    // 2. Перевірити чи BOM вже існує
    const [existing] = await (0, odoo_1.searchRead)('mrp.bom', [['product_id', '=', resolved.variantId], ['code', '=', reference]], ['id'], 1);
    if (existing) {
        console.log(`  [EXISTS] BOM вже існує (ID: ${existing.id}): ${label}`);
        return existing.id;
    }
    // 3. Створити запис BOM
    const bomId = await (0, odoo_1.create)('mrp.bom', {
        product_id: resolved.variantId,
        product_tmpl_id: resolved.templateId,
        code: reference,
        product_qty: def.qty ?? 1,
        type: 'normal',
    });
    console.log(`  [+] BOM створено (ID: ${bomId}): ${label}`);
    // 4. Створити операції, зберегти їх ID
    const opIds = [];
    for (let i = 0; i < def.operations.length; i++) {
        const op = def.operations[i];
        const wcId = await (0, product_1.getOrCreateWorkcenter)(op.workcenter);
        const opId = await (0, odoo_1.create)('mrp.routing.workcenter', {
            name: op.name,
            bom_id: bomId,
            workcenter_id: wcId,
            sequence: i + 1,
            x_studio_piece_rate_2: op.priceRate ?? 0,
        });
        opIds.push(opId);
        console.log(`    [op] "${op.name}" — ціна: ${op.priceRate ?? 0}`);
    }
    // 5. Створити рядки BOM (компоненти)
    for (let i = 0; i < def.components.length; i++) {
        const comp = def.components[i];
        const compLabel = comp.variants?.length
            ? `${comp.product} (${comp.variants.join(', ')})`
            : comp.product;
        const compResolved = await (0, product_1.resolveProduct)(comp.product, comp.variants);
        if (!compResolved) {
            console.warn(`    [SKIP] Компонент не знайдено: ${compLabel}`);
            continue;
        }
        const operationId = comp.operationIndex !== undefined
            ? (opIds[comp.operationIndex] ?? false)
            : false;
        await (0, odoo_1.create)('mrp.bom.line', {
            bom_id: bomId,
            product_id: compResolved.variantId,
            product_qty: comp.qty,
            product_uom_id: comp.uomId,
            sequence: i + 1,
            operation_id: operationId,
        });
        console.log(`    [+] ${compLabel} × ${comp.qty}`);
    }
    return bomId;
}
/**
 * Послідовно створити масив специфікацій.
 * Виводить підсумок після завершення.
 */
async function createAllBoms(boms) {
    let created = 0, skipped = 0, errors = 0;
    for (const def of boms) {
        const label = bomLabel(def);
        console.log(`\n${'='.repeat(60)}`);
        console.log(label);
        console.log('='.repeat(60));
        try {
            const id = await createBom(def);
            if (id !== null)
                created++;
            else
                skipped++;
        }
        catch (err) {
            console.error(`[ERROR] ${err.message}`);
            errors++;
        }
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Готово. Створено: ${created} | Пропущено/існує: ${skipped} | Помилок: ${errors}`);
    console.log('='.repeat(60));
}
