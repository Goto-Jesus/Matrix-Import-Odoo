import * as fs from "fs";
import * as path from "path";
import { runAttributeCheck } from "./check-attributes";
import { runChainCheck } from "./check-chain";

const BASE_FOLDER = "docs_fixed";
const GOOD_FOLDER = path.join(BASE_FOLDER, "good");
const BAD_FOLDER = path.join(BASE_FOLDER, "bad");

interface FileResult {
  fileName: string;
  hasIssues: boolean;
  issues: string[];
}

function processFile(absInput: string, goodDir: string, badDir: string): FileResult {
  const fileName = path.basename(absInput);
  const original = fs.readFileSync(absInput, "utf-8");

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Перевірка: ${fileName}`);
  console.log(`════════════════════════════════════════`);

  const attrResult = runAttributeCheck(original, fileName);
  const chainResult = runChainCheck(attrResult.content, fileName);

  const allIssues = [...attrResult.issues, ...chainResult.issues];
  const hasIssues = allIssues.length > 0;

  const destDir = hasIssues ? badDir : goodDir;
  const outputPath = path.join(destDir, fileName);
  fs.writeFileSync(outputPath, chainResult.content, "utf-8");

  const label = hasIssues ? "❌ bad" : "✅ good";
  console.log(`  → [${label}] ${outputPath}`);

  return { fileName, hasIssues, issues: allIssues };
}

function writeReport(results: FileResult[], reportPath: string): void {
  const now = new Date().toISOString().slice(0, 10);
  const good = results.filter((r) => !r.hasIssues);
  const bad = results.filter((r) => r.hasIssues);

  const lines: string[] = [
    `# Звіт перевірки документів`,
    ``,
    `Дата: ${now}`,
    `Всього файлів: ${results.length}`,
    ``,
  ];

  lines.push(`## ✅ Без помилок (${good.length} файлів)`);
  if (good.length === 0) {
    lines.push(`_—_`);
  } else {
    for (const r of good) lines.push(`- ${r.fileName}`);
  }
  lines.push(``);

  lines.push(`## ❌ З помилками (${bad.length} файлів)`);
  if (bad.length === 0) {
    lines.push(`_—_`);
  } else {
    for (const r of bad) {
      lines.push(``, `### ${r.fileName}`);
      for (const issue of r.issues) {
        lines.push(`- ${issue}`);
      }
    }
  }
  lines.push(``);

  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(`\n📄 Звіт: ${reportPath}`);
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

  const goodDir = path.join(process.cwd(), GOOD_FOLDER);
  const badDir = path.join(process.cwd(), BAD_FOLDER);
  fs.mkdirSync(goodDir, { recursive: true });
  fs.mkdirSync(badDir, { recursive: true });

  const reportPath = path.join(process.cwd(), BASE_FOLDER, "report.md");
  const stat = fs.statSync(absArg);
  const results: FileResult[] = [];

  if (stat.isDirectory()) {
    const files = fs.readdirSync(absArg).filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      console.log("Жодного .md файлу не знайдено.");
      return;
    }
    console.log(`\nОбробка ${files.length} файлів з ${absArg}\n`);
    for (const file of files) {
      results.push(processFile(path.join(absArg, file), goodDir, badDir));
    }
  } else {
    results.push(processFile(absArg, goodDir, badDir));
  }

  writeReport(results, reportPath);

  const goodCount = results.filter((r) => !r.hasIssues).length;
  const badCount = results.filter((r) => r.hasIssues).length;
  console.log(`\n✅ Готово. Без помилок: ${goodCount}, з помилками: ${badCount}. Оригінали не змінено.\n`);
}

main();
