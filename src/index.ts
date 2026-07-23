import { runSnapshot } from './commands/snapshot';
import { runRestore } from './commands/restore';
import { runValidate } from './commands/validate';
import { runValidateAll } from './commands/validateAll';
import { runImport } from './commands/importSpec';
import { runCheck } from './commands/check';
import { createAllBoms } from './bom/creator';
import { neo3Boms } from './specs/neo3-mekhanizm';

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'snapshot':
      await runSnapshot(args[0]);
      break;

    case 'restore':
      await runRestore(args[0]);
      break;

    case 'validate':
      await runValidate(args[0]);
      break;

    case 'validate-all':
      await runValidateAll(args[0]);
      break;

    case 'import':
      await runImport(args[0]);
      break;

    case 'check':
      await runCheck(args[0], ...args.slice(1));
      break;

    case 'bom':
      await createAllBoms(neo3Boms);
      break;

    default:
      console.log(`
Використання:
  npm run validate "<файл>"       — авто-форматування + список помилок
  npm run validate-all [папка]   — валідація всіх .md у папці (default: documents/)
  npm run import "<файл>"     — парсинг та імпорт специфікації в Odoo
  npm run check "<продукт>"   — перевірити чи продукт існує в Odoo
  npm run snapshot [мітка]         — зберегти поточний стан Odoo
  npm run restore                  — показати список імпортів
  npm run restore -- "<назва>"     — відкатити конкретний імпорт
  npm run restore -- all           — відкатити всі імпорти
  npm run dev bom             — legacy: Нео-3 Механізм з hardcoded TypeScript
      `);
  }
}

main().catch(err => {
  console.error('\n[ПОМИЛКА]', err.message);
  process.exit(1);
});
