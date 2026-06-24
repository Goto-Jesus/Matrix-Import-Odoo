import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { parseSpecFile } from '../parser/specParser';
import { createAllBoms } from '../bom/creator';
import { getEntry, setEntry, archiveEntry } from '../registry/registry';
import { checkDocument } from '../validator/checker';

function extractSofaName(filePath: string): string {
  return path.basename(filePath, '.md');
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => {
    rl.close();
    resolve(answer.trim().toLowerCase());
  }));
}

export async function runImport(filePath: string): Promise<void> {
  if (!filePath) {
    console.error('Використання: npm run import <шлях до файлу>');
    console.error('Наприклад:  npm run import "documents/Диван Нео-3 Колеса.md"');
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Файл не знайдено: ${absPath}`);
    process.exit(1);
  }

  const sofaName = extractSofaName(absPath);
  const fileName = path.basename(absPath);

  console.log(`\n📦 Імпорт: ${fileName}`);
  console.log('─'.repeat(50));

  // Перевірити чи є помилки
  const checkResult = checkDocument(absPath);
  if (!checkResult.valid) {
    console.error(`\n❌ Файл містить ${checkResult.errors.length} помилок — імпорт заблоковано.`);
    console.error('   Запустіть: npm run validate "' + filePath + '"');
    process.exit(1);
  }

  if (checkResult.warnings.length > 0) {
    console.warn(`\n⚠️  ${checkResult.warnings.length} попереджень. Продовжуємо...`);
  }

  // Перевірити реєстр
  const existing = getEntry(sofaName);
  if (existing && existing.status === 'active') {
    console.log(`\n⚠️  "${sofaName}" вже імпортований (${existing.importedAt}).`);
    console.log(`   BOM IDs: [${existing.bomIds.join(', ')}]`);
    const answer = await askQuestion('\n   Оновити? Старі BOM будуть заархівовані [т/н]: ');
    if (answer !== 'т' && answer !== 'y' && answer !== 'yes') {
      console.log('   Імпорт скасовано.');
      return;
    }
    archiveEntry(sofaName);
    console.log('   📦 Попередній запис заархівовано.');
  }

  // Парсинг
  console.log('\n📖 Парсинг специфікації...');
  let boms;
  try {
    boms = parseSpecFile(absPath);
  } catch (err: any) {
    console.error(`\n❌ Помилка парсингу: ${err.message}`);
    process.exit(1);
  }

  if (boms.length === 0) {
    console.error('\n❌ Жодного BOM не знайдено в файлі. Перевірте формат.');
    process.exit(1);
  }

  console.log(`   Знайдено ${boms.length} BOM(s).`);
  for (const bom of boms) {
    const varStr = bom.variants?.join(', ') ?? '-';
    console.log(`   • [${bom.product}] (${varStr})`);
  }

  // Імпорт
  console.log('\n🚀 Імпорт в Odoo...');
  await createAllBoms(boms);

  // Зберегти в реєстр (без bomIds бо creator не повертає їх — TODO)
  setEntry(sofaName, {
    specFile: filePath,
    importedAt: new Date().toISOString().split('T')[0],
    bomIds: [],
    status: 'active',
  });

  console.log(`\n✅ "${sofaName}" успішно імпортовано.`);
}
