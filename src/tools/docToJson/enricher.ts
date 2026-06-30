import { BomEntry } from './types';

interface SnapshotEntity { id: number; name: string; }
interface SnapshotVariant { id: number; display_name: string; product_tmpl_id: [number, string]; }

export interface SnapshotData {
  productTemplates: SnapshotEntity[];
  productVariants: SnapshotVariant[];
  workcenters: (SnapshotEntity & { code?: string })[];
  uoms: SnapshotEntity[];
}

const UOM_ALIAS: Record<string, string> = {
  'шт': 'Одиниці',
};

// Workcenter names in the document that map to a different (existing) name in Odoo
const WORKCENTER_ALIAS: Record<string, string> = {
  'Цех №4-1 Сборка Бильце': 'Цех №4 Сборка [полуфабрикатів]',
  'Цех №4-2 Сборка Карказ': 'Цех №4 Сборка [полуфабрикатів]',
  'ВТК':                    'Цех Відділ Технічного котнтролю',
};

function buildDisplayName(templateName: string, attrValues: { value: string }[]): string {
  if (!attrValues.length) return templateName;
  return `${templateName} (${attrValues.map(a => a.value).join(', ')})`;
}

export function enrichBoms(boms: BomEntry[], snapshot: SnapshotData): void {
  const templateByName = new Map<string, number>();
  snapshot.productTemplates.forEach(t => templateByName.set(t.name, t.id));

  const variantByDisplayName = new Map<string, number>();
  snapshot.productVariants.forEach(v => variantByDisplayName.set(v.display_name, v.id));

  const workcenterByName = new Map<string, number>();
  snapshot.workcenters.forEach(w => workcenterByName.set(w.name, w.id));

  const uomByName = new Map<string, number>();
  snapshot.uoms.forEach(u => uomByName.set(u.name, u.id));

  function resolveUomId(uom: string): number | undefined {
    return uomByName.get(UOM_ALIAS[uom] ?? uom);
  }

  for (const bom of boms) {
    const tmplId = templateByName.get(bom.product.templateName);
    const varId = variantByDisplayName.get(bom.product.variantDisplayName);
    if (tmplId !== undefined) bom.product.odooTemplateId = tmplId;
    if (varId !== undefined) bom.product.odooVariantId = varId;

    for (const op of bom.operations) {
      const resolvedName = WORKCENTER_ALIAS[op.workcenterName] ?? op.workcenterName;
      const wcId = workcenterByName.get(resolvedName);
      if (wcId !== undefined) op.odooWorkcenterId = wcId;
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
      if (compTmplId !== undefined) comp.odooTemplateId = compTmplId;
      if (compVarId !== undefined) comp.odooVariantId = compVarId;

      const uomId = resolveUomId(comp.uom);
      if (uomId !== undefined) comp.odooUomId = uomId;
    }
  }
}
