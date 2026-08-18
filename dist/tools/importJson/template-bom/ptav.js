"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preSeedPtavCache = preSeedPtavCache;
exports.getPtavId = getPtavId;
const odoo_1 = require("../../../api/odoo");
// Cache: `${templateId}::${attrName}::${valueName}` → ptavId | null
const _cache = new Map();
const _preloaded = new Set();
/**
 * Batch-load all PTAVs for a template into cache.
 * Call once per template before creating BOM lines.
 */
async function preSeedPtavCache(templateId) {
    if (_preloaded.has(templateId))
        return;
    const ptavs = await (0, odoo_1.searchRead)('product.template.attribute.value', [['product_tmpl_id', '=', templateId]], ['id', 'name', 'attribute_id']);
    for (const p of ptavs) {
        _cache.set(`${templateId}::${p.attribute_id[1]}::${p.name}`, p.id);
    }
    _preloaded.add(templateId);
    console.log(`  [ptav] Шаблон ${templateId}: ${ptavs.length} PTAV завантажено`);
}
/**
 * Resolve a PTAV ID for a specific attribute value on a template.
 * Returns null if not found (logs warning).
 */
async function getPtavId(templateId, attrName, valueName) {
    const key = `${templateId}::${attrName}::${valueName}`;
    if (_cache.has(key))
        return _cache.get(key);
    const [rec] = await (0, odoo_1.searchRead)('product.template.attribute.value', [
        ['product_tmpl_id', '=', templateId],
        ['attribute_id.name', '=', attrName],
        ['name', '=', valueName],
    ], ['id'], 1);
    const id = rec?.id ?? null;
    _cache.set(key, id);
    if (id === null) {
        console.warn(`  [WARN] PTAV не знайдено: "${attrName}"="${valueName}" на шаблоні ${templateId}`);
    }
    return id;
}
