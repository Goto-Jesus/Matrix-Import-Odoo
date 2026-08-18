"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandEntry = expandEntry;
function cartesian(expand) {
    const keys = Object.keys(expand);
    if (keys.length === 0)
        return [{}];
    let combos = [{}];
    for (const key of keys) {
        const next = [];
        for (const combo of combos) {
            for (const val of expand[key]) {
                next.push({ ...combo, [key]: val });
            }
        }
        combos = next;
    }
    return combos;
}
function substitute(text, combo) {
    return text.replace(/%([^%]+)%/g, (_, name) => combo[name] ?? `%${name}%`);
}
function substituteEntry(entry, combo) {
    return {
        product: {
            ...entry.product,
            attributes: entry.product.attributes.map(a => ({
                ...a,
                value: substitute(a.value, combo),
            })),
            variantDisplayName: substitute(entry.product.variantDisplayName, combo),
        },
        operations: entry.operations.map(op => ({
            ...op,
            name: substitute(op.name, combo),
        })),
        components: entry.components
            .filter(comp => matchesIfAttr(comp, combo))
            .map(comp => ({
            ...comp,
            attributes: comp.attributes.map(a => ({
                ...a,
                value: substitute(a.value, combo),
            })),
        })),
    };
}
function matchesIfAttr(comp, combo) {
    if (!comp.ifAttr)
        return true;
    for (const [attrName, requiredValue] of Object.entries(comp.ifAttr)) {
        if (combo[attrName] !== undefined && combo[attrName] !== requiredValue) {
            return false;
        }
    }
    return true;
}
// Fuzzy match: normalise duplicate letters and check prefix containment.
// Handles typos like "Посиленний" vs "Посилений" and extra words like "Звичайний Блок" vs "Звичайний".
function matchesTagValue(comboValue, tagValue) {
    const norm = (s) => s.toLowerCase().replace(/(.)\1+/g, '$1').trim();
    const cn = norm(comboValue);
    const tn = norm(tagValue);
    return cn === tn || tn.startsWith(cn) || cn.startsWith(tn);
}
function expandEntry(entry) {
    if (!entry.expand || Object.keys(entry.expand).length === 0)
        return [entry];
    const combos = cartesian(entry.expand);
    // Filter combos by the product's own @Attr=Value constraint (або-variant selector)
    const filtered = entry.product.ifAttr
        ? combos.filter(combo => {
            for (const [attr, required] of Object.entries(entry.product.ifAttr)) {
                const actual = combo[attr];
                if (actual !== undefined && !matchesTagValue(actual, required))
                    return false;
            }
            return true;
        })
        : combos;
    return filtered.map(combo => substituteEntry(entry, combo));
}
