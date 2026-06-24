import { searchRead, create, write, executeKw } from '../api/odoo';
import type { ResolvedProduct } from './types';

const normalizeStr = (s: string): string =>
  s.trim().replace(/[Xx]/g, 'х').replace(/\s+/g, ' ').toLowerCase();

/** Знайти шаблон товару за точною назвою */
export async function findTemplate(name: string): Promise<{ id: number } | null> {
  const [rec] = await searchRead<{ id: number }>(
    'product.template', [['name', '=', name]], ['id'], 1
  );
  return rec ?? null;
}

/**
 * Знайти варіант товару за назвою шаблону та значеннями атрибутів.
 *
 * Якщо attrValues не задано або порожньо — повертає перший (єдиний) варіант.
 * Якщо задано — шукає варіант, де ВСІ вказані значення збігаються
 * (з нормалізацією: x/X → х, lower, trim).
 */
export async function resolveProduct(
  productName: string,
  attrValues?: string[]
): Promise<ResolvedProduct | null> {
  const tmpl = await findTemplate(productName);
  if (!tmpl) {
    console.warn(`  [WARN] Шаблон не знайдено: "${productName}"`);
    return null;
  }

  const variants = await searchRead<{
    id: number;
    display_name: string;
    product_template_attribute_value_ids: number[];
  }>(
    'product.product',
    [['product_tmpl_id', '=', tmpl.id]],
    ['id', 'display_name', 'product_template_attribute_value_ids']
  );

  if (!attrValues || attrValues.length === 0) {
    const v = variants[0];
    if (!v) return null;
    return { variantId: v.id, templateId: tmpl.id, displayName: v.display_name };
  }

  const requiredNorm = attrValues.map(normalizeStr);

  for (const v of variants) {
    if (!v.product_template_attribute_value_ids.length) continue;

    const ptavs = await executeKw<{ name: string }[]>(
      'product.template.attribute.value', 'read',
      [v.product_template_attribute_value_ids],
      { fields: ['name'] }
    );

    const variantNorms = ptavs.map(p => normalizeStr(p.name));
    const allMatch = requiredNorm.every(req => variantNorms.includes(req));

    if (allMatch) {
      return { variantId: v.id, templateId: tmpl.id, displayName: v.display_name };
    }
  }

  console.warn(`  [WARN] Варіант не знайдено: "${productName}" [${attrValues.join(', ')}]`);
  return null;
}

/** Отримати або створити атрибут товару */
export async function getOrCreateAttribute(name: string): Promise<number> {
  const [existing] = await searchRead<{ id: number }>(
    'product.attribute', [['name', '=', name]], ['id'], 1
  );
  if (existing) return existing.id;

  const id = await create('product.attribute', { name, create_variant: 'always' });
  console.log(`  [+] Атрибут створено: "${name}" (ID: ${id})`);
  return id;
}

/** Отримати або створити значення атрибуту */
export async function getOrCreateAttributeValue(attrId: number, valueName: string): Promise<number> {
  const [existing] = await searchRead<{ id: number }>(
    'product.attribute.value',
    [['attribute_id', '=', attrId], ['name', '=', valueName]],
    ['id'], 1
  );
  if (existing) return existing.id;

  const id = await create('product.attribute.value', { attribute_id: attrId, name: valueName });
  console.log(`    [+] Значення атрибуту створено: "${valueName}" (ID: ${id})`);
  return id;
}

/** Отримати або створити робочий центр */
export async function getOrCreateWorkcenter(name: string): Promise<number> {
  const [existing] = await searchRead<{ id: number }>(
    'mrp.workcenter', [['name', '=', name]], ['id'], 1
  );
  if (existing) return existing.id;

  const id = await create('mrp.workcenter', { name, time_efficiency: 100 });
  console.log(`  [+] Робочий центр створено: "${name}" (ID: ${id})`);
  return id;
}

/**
 * Забезпечити існування варіанту.
 * Якщо значення атрибуту ще немає — створює його і додає до рядку атрибуту шаблону.
 * Odoo автоматично генерує новий варіант після цього.
 *
 * attrLineValues: [{attrLineId, attrId, valueName}] — один запис на кожен атрибут
 */
export async function ensureVariant(
  templateId: number,
  attrLineValues: Array<{ attrLineId: number; attrId: number; valueName: string }>
): Promise<number | null> {
  const requiredNorm: string[] = [];

  for (const { attrLineId, attrId, valueName } of attrLineValues) {
    const valueId = await getOrCreateAttributeValue(attrId, valueName);
    await write('product.template.attribute.line', [attrLineId], {
      value_ids: [[4, valueId]],
    });
    requiredNorm.push(normalizeStr(valueName));
    console.log(`    [~] Значення "${valueName}" додано до рядку атрибуту ${attrLineId}`);
  }

  const variants = await searchRead<{
    id: number;
    product_template_attribute_value_ids: number[];
  }>(
    'product.product',
    [['product_tmpl_id', '=', templateId]],
    ['id', 'product_template_attribute_value_ids']
  );

  for (const v of variants) {
    if (!v.product_template_attribute_value_ids.length) continue;

    const ptavs = await executeKw<{ name: string }[]>(
      'product.template.attribute.value', 'read',
      [v.product_template_attribute_value_ids],
      { fields: ['name'] }
    );

    const norms = ptavs.map(p => normalizeStr(p.name));
    if (requiredNorm.every(r => norms.includes(r))) return v.id;
  }

  return null;
}

/**
 * Отримати рядки атрибутів шаблону.
 * Корисно для передачі в ensureVariant.
 */
export async function getTemplateAttrLines(templateId: number): Promise<Array<{
  id: number;
  attribute_id: [number, string];
  value_ids: number[];
}>> {
  return searchRead(
    'product.template.attribute.line',
    [['product_tmpl_id', '=', templateId]],
    ['id', 'attribute_id', 'value_ids']
  );
}
