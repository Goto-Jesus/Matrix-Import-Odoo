import { searchRead, create, write } from '../../api/odoo';
import { findTemplate, getOrCreateAttribute, getOrCreateAttributeValue, resolveProduct } from '../../bom/product';
import type { AttributeVal } from '../docToJson/types';
import type { ResolvedProduct } from '../../bom/types';

/**
 * Знайти або створити шаблон товару та його варіант за набором атрибутів.
 *
 * - Якщо шаблон не існує — створюється автоматично (storable або service).
 * - Для кожного атрибуту: знаходить/створює рядок атрибуту шаблону і додає значення.
 * - Odoo автоматично генерує варіант після додавання значень атрибутів.
 * - Якщо attributes порожній — повертає єдиний (базовий) варіант шаблону.
 */
export async function ensureVariantFromAttrs(
  templateName: string,
  attributes: AttributeVal[],
  isService = false
): Promise<ResolvedProduct | null> {
  let templateId: number;
  const existing = await findTemplate(templateName);

  if (existing) {
    templateId = existing.id;
  } else {
    templateId = await create('product.template', {
      name: templateName,
      type: isService ? 'service' : 'product',
      uom_id: 1,
      uom_po_id: 1,
    });
    console.log(`  [+] Шаблон створено: "${templateName}" (ID: ${templateId})`);
  }

  if (attributes.length === 0) {
    const [v] = await searchRead<{ id: number }>(
      'product.product',
      [['product_tmpl_id', '=', templateId]],
      ['id'], 1
    );
    if (!v) return null;
    return { variantId: v.id, templateId, displayName: templateName };
  }

  for (const attr of attributes) {
    const attrId = await getOrCreateAttribute(attr.attributeName);
    const valueId = await getOrCreateAttributeValue(attrId, attr.value);

    const [existingLine] = await searchRead<{ id: number; value_ids: number[] }>(
      'product.template.attribute.line',
      [['product_tmpl_id', '=', templateId], ['attribute_id', '=', attrId]],
      ['id', 'value_ids'], 1
    );

    if (existingLine) {
      if (!existingLine.value_ids.includes(valueId)) {
        await write('product.template.attribute.line', [existingLine.id], {
          value_ids: [[4, valueId]],
        });
        console.log(`    [~] "${attr.value}" → рядок атрибуту "${attr.attributeName}"`);
      }
    } else {
      await create('product.template.attribute.line', {
        product_tmpl_id: templateId,
        attribute_id: attrId,
        value_ids: [[4, valueId]],
      });
      console.log(`    [+] Рядок "${attr.attributeName}" → "${attr.value}" на шаблоні "${templateName}"`);
    }
  }

  return resolveProduct(templateName, attributes.map(a => a.value));
}
