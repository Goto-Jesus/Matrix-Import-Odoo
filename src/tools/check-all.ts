import * as fs from "fs";
import * as path from "path";
import { runAttributeCheck } from "./check-attributes";
import { runChainCheck } from "./check-chain";

const OUTPUT_FOLDER = "documents_fixed";

function processFile(absInput: string, outputDir: string): void {
  const fileName = path.basename(absInput);
  const outputPath = path.join(outputDir, fileName);
  const original = fs.readFileSync(absInput, "utf-8");

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Перевірка: ${fileName}`);
  console.log(`════════════════════════════════════════`);

  const attrFixed = runAttributeCheck(original, fileName);
  const chainFixed = runChainCheck(attrFixed, fileName);

  fs.writeFileSync(outputPath, chainFixed, "utf-8");
  console.log(`  → ${outputPath}`);
}

function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error("Usage: ts-node check-all.ts <file.md | folder/>");
    process.exit(1);
  }

  const absArg = path.resolve(inputArg);
  if (!fs.existsSync(absArg)) {
    console.error(`Не знайдено: ${absArg}`);
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), OUTPUT_FOLDER);
  fs.mkdirSync(outputDir, { recursive: true });

  const stat = fs.statSync(absArg);

  if (stat.isDirectory()) {
    const files = fs.readdirSync(absArg).filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      console.log("Жодного .md файлу не знайдено.");
      return;
    }
    console.log(`\nОбробка ${files.length} файлів з ${absArg} → ${outputDir}\n`);
    for (const file of files) {
      processFile(path.join(absArg, file), outputDir);
    }
    console.log(`\n✅ Готово. Оброблено ${files.length} файлів. Оригінали не змінено.\n`);
  } else {
    processFile(absArg, outputDir);
    console.log(`\n✅ Готово. Оригінал не змінено.\n`);
  }
}

main();
