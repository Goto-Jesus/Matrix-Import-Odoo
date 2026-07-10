import * as fs from "fs";
import * as path from "path";
import { runAttributeCheck } from "./check-attributes";
import { runChainCheck } from "./check-chain";

const OUTPUT_FOLDER = "documents_fixed";

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: ts-node check-all.ts <path-to-md-file>");
    process.exit(1);
  }

  const absInput = path.resolve(filePath);
  if (!fs.existsSync(absInput)) {
    console.error(`Файл не знайдено: ${absInput}`);
    process.exit(1);
  }

  const fileName = path.basename(absInput);
  const outputDir = path.join(process.cwd(), OUTPUT_FOLDER);
  const outputPath = path.join(outputDir, fileName);

  const original = fs.readFileSync(absInput, "utf-8");

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Перевірка: ${fileName}`);
  console.log(`════════════════════════════════════════`);

  // Step 1: fix attributes
  const attrFixed = runAttributeCheck(original, fileName);

  // Step 2: fix chains on already-attributed content
  const chainFixed = runChainCheck(attrFixed, fileName);

  // Write result — original is never modified
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, chainFixed, "utf-8");

  console.log(`\n✅ Готово. Результат збережено:`);
  console.log(`   ${outputPath}`);
  console.log(`   (оригінал не змінено)\n`);
}

main();
