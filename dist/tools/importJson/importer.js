"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importBomEntry = importBomEntry;
exports.importAllBoms = importAllBoms;
const odoo_1 = require("../../api/odoo");
const tracker_1 = require("../../state/tracker");
let _existingBomsByCode = null;
async function preFetchBoms() {
    const boms = await (0, odoo_1.searchRead)('mrp.bom', [], ['id', 'code']);
    _existingBomsByCode = new Map(boms.filter(b => b.code).map(b => [b.code, b.id]));
    console.log(`  [cache] Завантажено ${_existingBomsByCode.size} BOM-кодів`);
}
const product_1 = require("../../bom/product");
const resolver_1 = require("./resolver");
const expander_1 = require("./expander");
const UOM_MAP = {
    'шт': 1,
    'шт.': 1,
    'm': 8,
    'm²': 10,
    'г': 14,
    'кг': 15,
    'm³': 30,
};
function sec(start) {
    return `${((Date.now() - start) / 1000).toFixed(2)}s`;
}
function uomStrToId(uom) {
    const id = UOM_MAP[uom];
    if (id === undefined) {
        console.warn(`  [WARN] Невідома одиниця "${uom}", використовується шт`);
        return 1;
    }
    return id;
}
async function deleteWrongBoms(templateCode) {
    const existing = await (0, odoo_1.searchRead)('mrp.bom', [['code', '=', templateCode]], ['id']);
    if (existing.length) {
        await (0, odoo_1.unlink)('mrp.bom', existing.map(b => b.id));
        console.log(`  [DEL] Видалено ${existing.length} BOM(и) з кодом "${templateCode}"`);
    }
}
async function importBomEntry(entry) {
    const { product, operations, components } = entry;
    const bomCode = product.variantDisplayName;
    // 1. Знайти/створити вихідний варіант товару
    let t = Date.now();
    const resolved = await (0, resolver_1.ensureVariantFromAttrs)(product.templateName, product.attributes);
    if (!resolved) {
        console.warn(`  [SKIP] Не вдалося вирішити товар для: ${bomCode} (${sec(t)})`);
        return null;
    }
    // 2. Перевірити чи BOM вже існує (локальний кеш → без запиту до Odoo)
    const existingId = _existingBomsByCode?.get(bomCode);
    if (existingId !== undefined) {
        console.log(`  [EXISTS] BOM (ID: ${existingId}): ${bomCode} (${sec(t)})`);
        return 'existed';
    }
    // 3. Створити BOM
    t = Date.now();
    const bomId = await (0, odoo_1.create)('mrp.bom', {
        product_id: resolved.variantId,
        product_tmpl_id: resolved.templateId,
        code: bomCode,
        product_qty: product.qty,
        type: 'normal',
    });
    tracker_1.track.bom(bomId);
    _existingBomsByCode?.set(bomCode, bomId);
    console.log(`  [+] BOM (ID: ${bomId}): ${bomCode} (${sec(t)})`);
    // 4. Створити операції
    const opIds = [];
    for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        t = Date.now();
        const wcId = await (0, product_1.getOrCreateWorkcenter)(op.workcenterName);
        const opId = await (0, odoo_1.create)('mrp.routing.workcenter', {
            name: op.name,
            bom_id: bomId,
            workcenter_id: wcId,
            sequence: i + 1,
            x_studio_piece_rate_2: op.priceRate,
        });
        tracker_1.track.operation(opId);
        opIds.push(opId);
        console.log(`    [op] "${op.name}" (${op.priceRate} грн) (${sec(t)})`);
    }
    // 5. Створити рядки BOM (компоненти)
    for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        t = Date.now();
        const compResolved = await (0, resolver_1.ensureVariantFromAttrs)(comp.templateName, comp.attributes, comp.isService ?? false, true);
        if (!compResolved) {
            console.warn(`    [SKIP] Компонент: "${comp.templateName}" (${sec(t)})`);
            continue;
        }
        const operationId = opIds[comp.operationIndex] ?? false;
        const lineId = await (0, odoo_1.create)('mrp.bom.line', {
            bom_id: bomId,
            product_id: compResolved.variantId,
            product_qty: comp.qty,
            product_uom_id: uomStrToId(comp.uom),
            sequence: i + 1,
            operation_id: operationId,
        });
        tracker_1.track.bomLine(lineId);
        const label = comp.attributes.length
            ? `${comp.templateName} (${comp.attributes.map(a => a.value).join(', ')})`
            : comp.templateName;
        console.log(`    [+] ${label} × ${comp.qty} ${comp.uom} (${sec(t)})`);
    }
    return 'created';
}
async function ensureVariantLimit(minLimit = 10000) {
    const [existing] = await (0, odoo_1.searchRead)('ir.config_parameter', [['key', '=', 'product.dynamic_variant_limit']], ['id', 'value'], 1);
    if (existing) {
        const current = parseInt(existing.value, 10);
        if (current < minLimit) {
            await (0, odoo_1.write)('ir.config_parameter', [existing.id], { value: String(minLimit) });
            console.log(`[config] product.dynamic_variant_limit: ${current} → ${minLimit}`);
        }
    }
    else {
        await (0, odoo_1.create)('ir.config_parameter', { key: 'product.dynamic_variant_limit', value: String(minLimit) });
        console.log(`[config] product.dynamic_variant_limit = ${minLimit}`);
    }
}
async function importAllBoms(boms, label) {
    (0, tracker_1.resetSession)();
    let created = 0, existed = 0, skipped = 0, errors = 0;
    const totalStart = Date.now();
    await ensureVariantLimit(10000);
    // Pass 1: розгорнути всі записи і батчем записати атрибути в Odoo.
    // Odoo генерує варіанти ОДИН РАЗ на шаблон, а не після кожного write.
    const allExpanded = boms.flatMap(entry => (0, expander_1.expandEntry)(entry));
    await (0, resolver_1.preSeedAttributeLines)(allExpanded);
    await preFetchBoms();
    const cехStats = [];
    for (const entry of boms) {
        const expanded = (0, expander_1.expandEntry)(entry);
        const isExpanded = expanded.length > 1;
        const entryStart = Date.now();
        let eCr = 0, eEx = 0, eSk = 0, eEr = 0;
        console.log(`\n${'='.repeat(60)}`);
        console.log(entry.product.variantDisplayName);
        if (isExpanded)
            console.log(`  → розширення: ${expanded.length} варіантів`);
        console.log('='.repeat(60));
        // Delete wrong placeholder BOMs before creating correct expanded ones
        if (entry.expand) {
            try {
                await deleteWrongBoms(entry.product.variantDisplayName);
            }
            catch (err) {
                console.warn(`  [WARN] Не вдалося видалити старі BOM: ${err.message}`);
            }
        }
        for (const expandedEntry of expanded) {
            try {
                const result = await importBomEntry(expandedEntry);
                if (result === 'created') {
                    created++;
                    eCr++;
                }
                else if (result === 'existed') {
                    existed++;
                    eEx++;
                }
                else {
                    skipped++;
                    eSk++;
                }
            }
            catch (err) {
                console.error(`[ERROR] ${expandedEntry.product.variantDisplayName}: ${err.message}`);
                errors++;
                eEr++;
            }
        }
        const elapsed = Date.now() - entryStart;
        console.log(`  [час] Загалом: ${sec(entryStart)}`);
        cехStats.push({ name: entry.product.variantDisplayName, elapsed, created: eCr, existed: eEx, skipped: eSk, errors: eEr });
    }
    (0, tracker_1.saveSession)(label);
    const LINE = '='.repeat(60);
    console.log(`\n${LINE}`);
    console.log('СТАТИСТИКА ПО ЦЕХАХ');
    console.log(LINE);
    for (const s of cехStats) {
        const t = `${(s.elapsed / 1000).toFixed(2)}s`.padStart(8);
        const parts = [
            s.created ? `+${s.created} створено` : '',
            s.existed ? `=${s.existed} існує` : '',
            s.skipped ? `?${s.skipped} пропущено` : '',
            s.errors ? `!${s.errors} помилок` : '',
        ].filter(Boolean).join('  ');
        console.log(`${t}  ${s.name}${parts ? `  [${parts}]` : ''}`);
    }
    console.log(LINE);
    console.log(`Підсумок: +${created} створено  =${existed} існує  ?${skipped} пропущено  !${errors} помилок`);
    console.log(`Загальний час: ${sec(totalStart)}`);
    console.log(LINE);
}
