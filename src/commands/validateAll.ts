import * as fs from 'fs';
import * as path from 'path';
import { runValidate } from './validate';

const DEFAULT_DIR = 'documents';

export async function runValidateAll(dirArg?: string): Promise<void> {
  const dir = path.resolve(process.cwd(), dirArg ?? DEFAULT_DIR);

  if (!fs.existsSync(dir)) {
    console.error(`Папку не знайдено: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.error(`У папці немає .md файлів: ${dir}`);
    process.exit(1);
  }

  console.log(`\n📁 Папка: ${path.relative(process.cwd(), dir)}`);
  console.log(`📋 Файлів: ${files.length}\n`);
  console.log('═'.repeat(60));

  let ok = 0;
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const relPath = path.join(dirArg ?? DEFAULT_DIR, files[i]);
    console.log(`\n[${i + 1}/${files.length}]`);

    try {
      await runValidate(relPath);
      ok++;
    } catch (e: any) {
      console.error(`\n❌ Збій при обробці "${files[i]}": ${e.message}`);
      errors++;
    }

    console.log('─'.repeat(60));
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Оброблено: ${ok}   ❌ Збоїв: ${errors}   Всього: ${files.length}`);
}
