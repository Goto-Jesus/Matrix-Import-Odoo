import type { BomEntry, ComponentEntry } from '../docToJson/types';

type Combo = Record<string, string>;

function cartesian(expand: Record<string, string[]>): Combo[] {
  const keys = Object.keys(expand);
  if (keys.length === 0) return [{}];

  let combos: Combo[] = [{}];
  for (const key of keys) {
    const next: Combo[] = [];
    for (const combo of combos) {
      for (const val of expand[key]) {
        next.push({ ...combo, [key]: val });
      }
    }
    combos = next;
  }
  return combos;
}

function substitute(text: string, combo: Combo): string {
  return text.replace(/%([^%]+)%/g, (_, name) => combo[name] ?? `%${name}%`);
}

function substituteEntry(entry: BomEntry, combo: Combo): BomEntry {
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

function matchesIfAttr(comp: ComponentEntry, combo: Combo): boolean {
  if (!comp.ifAttr) return true;
  for (const [attrName, requiredValue] of Object.entries(comp.ifAttr)) {
    if (combo[attrName] !== undefined && combo[attrName] !== requiredValue) {
      return false;
    }
  }
  return true;
}

export function expandEntry(entry: BomEntry): BomEntry[] {
  if (!entry.expand || Object.keys(entry.expand).length === 0) return [entry];
  const combos = cartesian(entry.expand);
  return combos.map(combo => substituteEntry(entry, combo));
}
