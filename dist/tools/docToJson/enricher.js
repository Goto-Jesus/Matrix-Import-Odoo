"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichBoms = enrichBoms;
const UOM_ALIAS = {
    шт: "Одиниці",
};
// Workcenter names in the document that map to a different (existing) name in Odoo
const WORKCENTER_ALIAS = {
    "Цех №4-1 Сборка Бильце": "Цех №4 Сборка [полуфабрикатів]",
    "Цех №4-2 Сборка Каркаc": "Цех №4 Сборка [полуфабрикатів]",
    ВТК: "Цех Відділ Технічного котнтролю",
};
function buildDisplayName(templateName, attrValues) {
    if (!attrValues.length)
        return templateName;
    return `${templateName} (${attrValues.map((a) => a.value).join(", ")})`;
}
function enrichBoms(boms, snapshot) {
    const templateByName = new Map();
    snapshot.productTemplates.forEach((t) => templateByName.set(t.name, t.id));
    const variantByDisplayName = new Map();
    snapshot.productVariants.forEach((v) => variantByDisplayName.set(v.display_name, v.id));
    const workcenterByName = new Map();
    snapshot.workcenters.forEach((w) => workcenterByName.set(w.name, w.id));
    const uomByName = new Map();
    snapshot.uoms.forEach((u) => uomByName.set(u.name, u.id));
    function resolveUomId(uom) {
        return uomByName.get(UOM_ALIAS[uom] ?? uom);
    }
    // Normalize attribute names for case/space-insensitive lookup
    const normalizeAttr = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    // Build attribute-value lookup: normalized(attrName) → ordered list of values
    const attrValuesByName = new Map();
    if (snapshot.productAttributeValues) {
        for (const av of snapshot.productAttributeValues) {
            if (!av.attribute_id)
                continue;
            const key = normalizeAttr(av.attribute_id[1]);
            if (!attrValuesByName.has(key))
                attrValuesByName.set(key, []);
            attrValuesByName.get(key).push(av.name);
        }
    }
    for (const bom of boms) {
        const tmplId = templateByName.get(bom.product.templateName);
        const varId = variantByDisplayName.get(bom.product.variantDisplayName);
        if (tmplId !== undefined)
            bom.product.odooTemplateId = tmplId;
        if (varId !== undefined)
            bom.product.odooVariantId = varId;
        for (const op of bom.operations) {
            const resolvedName = WORKCENTER_ALIAS[op.workcenterName] ?? op.workcenterName;
            const wcId = workcenterByName.get(resolvedName);
            if (wcId !== undefined)
                op.odooWorkcenterId = wcId;
        }
        for (const comp of bom.components) {
            const displayName = buildDisplayName(comp.templateName, comp.attributes);
            let compTmplName = comp.templateName;
            let compDisplayName = displayName;
            // (Послуга) components are stored in Odoo with that prefix
            if (comp.isService) {
                compTmplName = `(Послуга) ${comp.templateName}`;
                compDisplayName = buildDisplayName(compTmplName, comp.attributes);
            }
            const compTmplId = templateByName.get(compTmplName);
            const compVarId = variantByDisplayName.get(compDisplayName);
            if (compTmplId !== undefined)
                comp.odooTemplateId = compTmplId;
            if (compVarId !== undefined)
                comp.odooVariantId = compVarId;
            const uomId = resolveUomId(comp.uom);
            if (uomId !== undefined)
                comp.odooUomId = uomId;
        }
        // Build expand config: collect all %AttrName% placeholders used in this BOM
        const placeholders = new Set();
        function scanForPlaceholders(str) {
            for (const m of str.matchAll(/%([^%]+)%/g))
                placeholders.add(m[1]);
        }
        for (const attr of bom.product.attributes) {
            scanForPlaceholders(attr.value);
            scanForPlaceholders(attr.attributeName);
        }
        scanForPlaceholders(bom.product.variantDisplayName);
        for (const comp of bom.components) {
            for (const attr of comp.attributes)
                scanForPlaceholders(attr.value);
            if (comp.ifAttr) {
                for (const val of Object.values(comp.ifAttr))
                    scanForPlaceholders(val);
            }
        }
        if (placeholders.size > 0) {
            const expand = {};
            for (const attrName of placeholders) {
                // %Name❌% → inactive attr, always expands to a single ["❌"] value
                if (attrName.endsWith('❌')) {
                    expand[attrName] = ['❌'];
                    continue;
                }
                const values = (attrValuesByName.get(normalizeAttr(attrName)) ?? [])
                    .filter(v => v !== '❌' && !v.startsWith('%'));
                if (values.length > 0) {
                    expand[attrName] = values;
                }
                else {
                    // Fallback: collect unique values from ifAttr tags in this BOM
                    const seen = new Set();
                    for (const comp of bom.components) {
                        if (comp.ifAttr && comp.ifAttr[attrName])
                            seen.add(comp.ifAttr[attrName]);
                    }
                    if (seen.size > 0)
                        expand[attrName] = [...seen];
                }
            }
            if (Object.keys(expand).length > 0)
                bom.expand = expand;
        }
    }
}
