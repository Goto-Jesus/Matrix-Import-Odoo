"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateTemplateVariantCache = invalidateTemplateVariantCache;
exports.findTemplate = findTemplate;
exports.cacheTemplate = cacheTemplate;
exports.resolveProduct = resolveProduct;
exports.getOrCreateAttribute = getOrCreateAttribute;
exports.getOrCreateAttributeValue = getOrCreateAttributeValue;
exports.getOrCreateWorkcenter = getOrCreateWorkcenter;
exports.ensureVariant = ensureVariant;
exports.getTemplateAttrLines = getTemplateAttrLines;
const odoo_1 = require("../api/odoo");
const tracker_1 = require("../state/tracker");
const normalizeStr = (s) => s.trim().replace(/[Xx]/g, 'х').replace(/\s+/g, ' ').toLowerCase();
const _templateCache = new Map();
const _attrCache = new Map();
const _attrValueCache = new Map();
const _workcenterCache = new Map();
// templateId → [{id, displayName, norms}] — завантажується одним батч-запитом
const _templateVariantCache = new Map();
/** Інвалідувати кеш варіантів шаблону (при додаванні нових значень атрибутів) */
function invalidateTemplateVariantCache(templateId) {
    _templateVariantCache.delete(templateId);
}
/** Знайти шаблон товару за точною назвою */
async function findTemplate(name) {
    if (_templateCache.has(name))
        return _templateCache.get(name);
    const [rec] = await (0, odoo_1.searchRead)('product.template', [['name', '=', name]], ['id'], 1);
    const result = rec ?? null;
    _templateCache.set(name, result);
    return result;
}
/** Записати шаблон у кеш після ручного створення */
function cacheTemplate(name, id) {
    _templateCache.set(name, { id });
}
/**
 * Знайти варіант товару за назвою шаблону та значеннями атрибутів.
 *
 * Якщо attrValues не задано або порожньо — повертає перший (єдиний) варіант.
 * Якщо задано — шукає варіант, де ВСІ вказані значення збігаються
 * (з нормалізацією: x/X → х, lower, trim).
 */
async function resolveProduct(productName, attrValues) {
    const tmpl = await findTemplate(productName);
    if (!tmpl) {
        console.warn(`  [WARN] Шаблон не знайдено: "${productName}"`);
        return null;
    }
    if (!attrValues || attrValues.length === 0) {
        const [v] = await (0, odoo_1.searchRead)('product.product', [['product_tmpl_id', '=', tmpl.id]], ['id', 'display_name'], 1);
        if (!v)
            return null;
        return { variantId: v.id, templateId: tmpl.id, displayName: v.display_name };
    }
    // Побудувати кеш варіантів шаблону якщо ще не завантажено.
    // Один searchRead + ОДИН батч executeKw для всіх PTAV → O(2) запити замість O(N).
    if (!_templateVariantCache.has(tmpl.id)) {
        const variants = await (0, odoo_1.searchRead)('product.product', [['product_tmpl_id', '=', tmpl.id]], ['id', 'display_name', 'product_template_attribute_value_ids']);
        const allPtavIds = [...new Set(variants.flatMap(v => v.product_template_attribute_value_ids))];
        const ptavNameById = new Map();
        if (allPtavIds.length > 0) {
            const ptavs = await (0, odoo_1.executeKw)('product.template.attribute.value', 'read', [allPtavIds], { fields: ['id', 'name'] });
            ptavs.forEach(p => ptavNameById.set(p.id, p.name));
        }
        _templateVariantCache.set(tmpl.id, variants.map(v => ({
            id: v.id,
            displayName: v.display_name,
            norms: v.product_template_attribute_value_ids.map(id => normalizeStr(ptavNameById.get(id) ?? '')),
        })));
    }
    const requiredNorm = attrValues.map(normalizeStr);
    for (const v of _templateVariantCache.get(tmpl.id)) {
        if (requiredNorm.every(req => v.norms.includes(req))) {
            return { variantId: v.id, templateId: tmpl.id, displayName: v.displayName };
        }
    }
    console.warn(`  [WARN] Варіант не знайдено: "${productName}" [${attrValues.join(', ')}]`);
    return null;
}
/** Отримати або створити атрибут товару */
async function getOrCreateAttribute(name) {
    if (_attrCache.has(name))
        return _attrCache.get(name);
    const [existing] = await (0, odoo_1.searchRead)('product.attribute', [['name', '=', name]], ['id'], 1);
    if (existing) {
        _attrCache.set(name, existing.id);
        return existing.id;
    }
    const id = await (0, odoo_1.create)('product.attribute', { name, create_variant: 'always' });
    tracker_1.track.attribute(id);
    console.log(`  [+] Атрибут створено: "${name}" (ID: ${id})`);
    _attrCache.set(name, id);
    return id;
}
/** Отримати або створити значення атрибуту */
async function getOrCreateAttributeValue(attrId, valueName) {
    const key = `${attrId}::${valueName}`;
    if (_attrValueCache.has(key))
        return _attrValueCache.get(key);
    const [existing] = await (0, odoo_1.searchRead)('product.attribute.value', [['attribute_id', '=', attrId], ['name', '=', valueName]], ['id'], 1);
    if (existing) {
        _attrValueCache.set(key, existing.id);
        return existing.id;
    }
    const id = await (0, odoo_1.create)('product.attribute.value', { attribute_id: attrId, name: valueName });
    tracker_1.track.attributeValue(id);
    console.log(`    [+] Значення атрибуту створено: "${valueName}" (ID: ${id})`);
    _attrValueCache.set(key, id);
    return id;
}
/** Отримати або створити робочий центр */
async function getOrCreateWorkcenter(name) {
    if (_workcenterCache.has(name))
        return _workcenterCache.get(name);
    const [existing] = await (0, odoo_1.searchRead)('mrp.workcenter', [['name', '=', name]], ['id'], 1);
    if (existing) {
        _workcenterCache.set(name, existing.id);
        return existing.id;
    }
    const id = await (0, odoo_1.create)('mrp.workcenter', { name, time_efficiency: 100 });
    tracker_1.track.workcenter(id);
    console.log(`  [+] Робочий центр створено: "${name}" (ID: ${id})`);
    _workcenterCache.set(name, id);
    return id;
}
/**
 * Забезпечити існування варіанту.
 * Якщо значення атрибуту ще немає — створює його і додає до рядку атрибуту шаблону.
 * Odoo автоматично генерує новий варіант після цього.
 *
 * attrLineValues: [{attrLineId, attrId, valueName}] — один запис на кожен атрибут
 */
async function ensureVariant(templateId, attrLineValues) {
    const requiredNorm = [];
    for (const { attrLineId, attrId, valueName } of attrLineValues) {
        const valueId = await getOrCreateAttributeValue(attrId, valueName);
        await (0, odoo_1.write)('product.template.attribute.line', [attrLineId], {
            value_ids: [[4, valueId]],
        });
        requiredNorm.push(normalizeStr(valueName));
        console.log(`    [~] Значення "${valueName}" додано до рядку атрибуту ${attrLineId}`);
    }
    const variants = await (0, odoo_1.searchRead)('product.product', [['product_tmpl_id', '=', templateId]], ['id', 'product_template_attribute_value_ids']);
    for (const v of variants) {
        if (!v.product_template_attribute_value_ids.length)
            continue;
        const ptavs = await (0, odoo_1.executeKw)('product.template.attribute.value', 'read', [v.product_template_attribute_value_ids], { fields: ['name'] });
        const norms = ptavs.map(p => normalizeStr(p.name));
        if (requiredNorm.every(r => norms.includes(r)))
            return v.id;
    }
    return null;
}
/**
 * Отримати рядки атрибутів шаблону.
 * Корисно для передачі в ensureVariant.
 */
async function getTemplateAttrLines(templateId) {
    return (0, odoo_1.searchRead)('product.template.attribute.line', [['product_tmpl_id', '=', templateId]], ['id', 'attribute_id', 'value_ids']);
}
