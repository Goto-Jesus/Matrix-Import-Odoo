import { resolveProduct } from '../bom/product';

export async function runCheck(productName: string, ...attrValues: string[]): Promise<void> {
  if (!productName) {
    console.error('Використання: npm run check "<назва продукту>" [значення атрибуту...]');
    console.error('Наприклад:  npm run check "Каркас - напівфабрикат" "100ДСП Механізм"');
    process.exit(1);
  }

  console.log(`\n🔍 Пошук: [${productName}]`);
  if (attrValues.length > 0) {
    console.log(`   Атрибути: ${attrValues.join(', ')}`);
  }
  console.log('─'.repeat(50));

  const result = await resolveProduct(productName, attrValues.length > 0 ? attrValues : undefined);

  if (result) {
    console.log(`\n✅ Знайдено:`);
    console.log(`   Назва:       ${result.displayName}`);
    console.log(`   Variant ID:  ${result.variantId}`);
    console.log(`   Template ID: ${result.templateId}`);
  } else {
    console.log(`\n❌ Продукт не знайдено в Odoo.`);
    if (attrValues.length > 0) {
      console.log(`   Перевірте: чи існує атрибут/значення "${attrValues.join(', ')}" в Odoo.`);
    }
  }
}
