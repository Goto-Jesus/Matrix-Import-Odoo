"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preSeedAttributeLines = preSeedAttributeLines;
exports.preSeedVariants = preSeedVariants;
exports.clearVariantDisplayCache = clearVariantDisplayCache;
exports.ensureVariantFromAttrs = ensureVariantFromAttrs;
const odoo_1 = require("../../api/odoo");
const product_1 = require("../../bom/product");
const tracker_1 = require("../../state/tracker");
let _storableType = null;
const _resolvedCache = new Map();
const _variantByDisplayName = new Map();
/**
 * Pass 1: Для всіх вже-розгорнутих BomEntry зібрати потрібні атрибути по шаблонах
 * та записати їх батчем (один write на рядок атрибута замість N write по одному).
 * Odoo генерує всі варіанти ОДИН РАЗ після запису, а не N разів.
 */
async function preSeedAttributeLines(entries) {
    const needed = new Map();
    const collect = (templateName, attrs, isService = false, isComponent = false) => {
        if (attrs.length === 0)
            return;
        if (!needed.has(templateName))
            needed.set(templateName, { attrMap: new Map(), isService, isComponent });
        const { attrMap } = needed.get(templateName);
        for (const attr of attrs) {
            if (attr.value.includes('%'))
                continue;
            const cleanName = attr.attributeName.replace(/❌$/, '');
            if (!attrMap.has(cleanName))
                attrMap.set(cleanName, new Set());
            attrMap.get(cleanName).add(attr.value);
        }
    };
    for (const entry of entries) {
        collect(entry.product.templateName, entry.product.attributes, false, false);
        for (const comp of entry.components) {
            collect(comp.templateName, comp.attributes, comp.isService ?? false, true);
        }
    }
    const sec = (t) => `${((Date.now() - t) / 1000).toFixed(2)}s`;
    console.log(`\n[pre-seed] Шаблонів з атрибутами: ${needed.size}`);
    for (const [templateName, { attrMap, isService, isComponent }] of needed) {
        let templateId;
        const existing = await (0, product_1.findTemplate)(templateName);
        if (existing) {
            templateId = existing.id;
        }
        else {
            const t = Date.now();
            templateId = await (0, odoo_1.create)('product.template', {
                name: templateName,
                type: isService ? 'service' : await getStorableType(),
                uom_id: 1,
                ...(isComponent ? { sale_ok: false } : {}),
            });
            tracker_1.track.template(templateId);
            (0, product_1.cacheTemplate)(templateName, templateId);
            console.log(`  [+] Шаблон: "${templateName}" (ID: ${templateId}) (${sec(t)})`);
        }
        for (const [attrName, valuesSet] of attrMap) {
            const attrId = await (0, product_1.getOrCreateAttribute)(attrName);
            const valueIds = [];
            for (const v of valuesSet) {
                valueIds.push(await (0, product_1.getOrCreateAttributeValue)(attrId, v));
            }
            const [existingLine] = await (0, odoo_1.searchRead)('product.template.attribute.line', [['product_tmpl_id', '=', templateId], ['attribute_id', '=', attrId]], ['id', 'value_ids'], 1);
            if (existingLine) {
                const missing = valueIds.filter(id => !existingLine.value_ids.includes(id));
                if (missing.length > 0) {
                    const t = Date.now();
                    // [4, id] = "link one" — додає без видалення існуючих значень
                    await (0, odoo_1.write)('product.template.attribute.line', [existingLine.id], {
                        value_ids: missing.map(id => [4, id]),
                    });
                    console.log(`  [~] "${templateName}" / "${attrName}": +${missing.length} значень (${sec(t)})`);
                }
            }
            else {
                const t = Date.now();
                await (0, odoo_1.create)('product.template.attribute.line', {
                    product_tmpl_id: templateId,
                    attribute_id: attrId,
                    value_ids: valueIds.map(id => [4, id]),
                });
                console.log(`  [+] "${templateName}" / "${attrName}": ${valueIds.length} значень (${sec(t)})`);
            }
        }
    }
    console.log(`[pre-seed] Готово — варіанти сгенеровані Odoo\n`);
}
function preSeedVariants(variants) {
    for (const v of variants) {
        _variantByDisplayName.set(v.display_name, {
            variantId: v.id,
            templateId: v.product_tmpl_id[0],
            displayName: v.display_name,
        });
    }
}
/** Очистити snapshot-кеш варіантів (викликати після preSeedAttributeLines щоб уникнути stale ID) */
function clearVariantDisplayCache() {
    _variantByDisplayName.clear();
}
async function getStorableType() {
    if (_storableType)
        return _storableType;
    const fields = await (0, odoo_1.fieldsGet)('product.template', ['selection']);
    const selection = fields.type?.selection ?? [];
    for (const key of ['consu', 'storable', 'product']) {
        if (selection.some(([k]) => k === key)) {
            _storableType = key;
            return key;
        }
    }
    _storableType = 'consu';
    return _storableType;
}
/**
 * Знайти або створити шаблон товару та його варіант за набором атрибутів.
 *
 * - Якщо шаблон не існує — створюється автоматично (storable або service).
 * - Для кожного атрибуту: знаходить/створює рядок атрибуту шаблону і додає значення.
 * - Odoo автоматично генерує варіант після додавання значень атрибутів.
 * - Якщо attributes порожній — повертає єдиний (базовий) варіант шаблону.
 */
async function ensureVariantFromAttrs(templateName, attributes, isService = false, isComponent = false) {
    // Skip attributes that still contain %placeholder% — they weren't fully resolved
    // Strip ❌ suffix from attributeName (inactive attrs keep their clean Odoo name)
    const resolvedAttrs = attributes
        .filter(a => !a.value.includes('%'))
        .map(a => ({ ...a, attributeName: a.attributeName.replace(/❌$/, '') }));
    const cacheKey = `${templateName}::${resolvedAttrs.map(a => `${a.attributeName}=${a.value}`).join(',')}`;
    if (_resolvedCache.has(cacheKey))
        return _resolvedCache.get(cacheKey);
    // Check snapshot pre-seed by expected display_name (avoids all Odoo calls for known variants)
    const expectedDisplayName = resolvedAttrs.length === 0
        ? templateName
        : `${templateName} (${resolvedAttrs.map(a => a.value).join(', ')})`;
    const fromSnapshot = _variantByDisplayName.get(expectedDisplayName);
    if (fromSnapshot) {
        _resolvedCache.set(cacheKey, fromSnapshot);
        return fromSnapshot;
    }
    let templateId;
    const existing = await (0, product_1.findTemplate)(templateName);
    if (existing) {
        templateId = existing.id;
    }
    else {
        templateId = await (0, odoo_1.create)('product.template', {
            name: templateName,
            type: isService ? 'service' : await getStorableType(),
            uom_id: 1,
            ...(isComponent ? { sale_ok: false } : {}),
        });
        tracker_1.track.template(templateId);
        console.log(`  [+] Шаблон створено: "${templateName}" (ID: ${templateId})`);
    }
    if (resolvedAttrs.length === 0) {
        const [v] = await (0, odoo_1.searchRead)('product.product', [['product_tmpl_id', '=', templateId]], ['id'], 1);
        const result = v ? { variantId: v.id, templateId, displayName: templateName } : null;
        _resolvedCache.set(cacheKey, result);
        return result;
    }
    for (const attr of resolvedAttrs) {
        const attrId = await (0, product_1.getOrCreateAttribute)(attr.attributeName);
        const valueId = await (0, product_1.getOrCreateAttributeValue)(attrId, attr.value);
        const [existingLine] = await (0, odoo_1.searchRead)('product.template.attribute.line', [['product_tmpl_id', '=', templateId], ['attribute_id', '=', attrId]], ['id', 'value_ids'], 1);
        if (existingLine) {
            if (!existingLine.value_ids.includes(valueId)) {
                await (0, odoo_1.write)('product.template.attribute.line', [existingLine.id], {
                    value_ids: [[4, valueId]],
                });
                (0, product_1.invalidateTemplateVariantCache)(templateId);
                console.log(`    [~] "${attr.value}" → рядок атрибуту "${attr.attributeName}"`);
            }
        }
        else {
            await (0, odoo_1.create)('product.template.attribute.line', {
                product_tmpl_id: templateId,
                attribute_id: attrId,
                value_ids: [[4, valueId]],
            });
            (0, product_1.invalidateTemplateVariantCache)(templateId);
            console.log(`    [+] Рядок "${attr.attributeName}" → "${attr.value}" на шаблоні "${templateName}"`);
        }
    }
    const result = await (0, product_1.resolveProduct)(templateName, resolvedAttrs.map(a => a.value));
    _resolvedCache.set(cacheKey, result);
    return result;
}
