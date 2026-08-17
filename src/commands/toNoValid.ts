import * as fs from "fs";
import * as path from "path";
import { toNoValidContent } from "../validator/toNoValid";

const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "docs", "documents_no_valid");

export async function runToNoValid(
  filePath?: string,
  outDirArg?: string,
): Promise<void> {
  if (!filePath) {
    console.error("Використання: npm run to-novalid -- <файл.md> [папка-виходу]");
    console.error('Наприклад:  npm run to-novalid -- doc-test/docs.md');
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Файл не знайдено: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const result = toNoValidContent(raw);
  const outDir = path.resolve(process.cwd(), outDirArg ?? DEFAULT_OUT_DIR);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, result.fileName);
  fs.writeFileSync(outPath, result.content, "utf-8");

  console.log(`\n📄 Вхід: ${path.relative(process.cwd(), absPath)}`);
  console.log(`📦 Модель: ${result.title}`);
  for (const change of result.changes) {
    console.log(`   • ${change}`);
  }
  console.log(`\n   ✅ Записано: ${path.relative(process.cwd(), outPath)}`);
  console.log(`   👉 Далі: npm run validate "${path.relative(process.cwd(), outPath)}"`);
}
