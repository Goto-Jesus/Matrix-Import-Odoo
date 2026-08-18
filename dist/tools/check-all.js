"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const specPipeline_1 = require("../validator/specPipeline");
const BASE_FOLDER = "docs_fixed";
const GOOD_FOLDER = path.join(BASE_FOLDER, "good");
const BAD_FOLDER = path.join(BASE_FOLDER, "bad");
function processFile(absInput, goodDir, badDir) {
    const fileName = path.basename(absInput);
    const original = fs.readFileSync(absInput, "utf-8");
    console.log(`\n════════════════════════════════════════`);
    console.log(`  Перевірка: ${fileName}`);
    console.log(`════════════════════════════════════════`);
    const tools = (0, specPipeline_1.runSpecTools)(original, fileName);
    const allIssues = [
        ...tools.attr.issues,
        ...tools.chain.issues,
        ...tools.bom.issues,
    ];
    if (tools.attr.error)
        allIssues.push(tools.attr.error);
    const autoFixed = allIssues.filter((i) => !(0, specPipeline_1.isBlockingIssue)(i));
    const blocking = allIssues.filter(specPipeline_1.isBlockingIssue);
    const destDir = blocking.length > 0 ? badDir : goodDir;
    const outputPath = path.join(destDir, fileName);
    fs.writeFileSync(outputPath, tools.content, "utf-8");
    const label = blocking.length > 0 ? "❌ bad" : autoFixed.length > 0 ? "🔧 fixed→good" : "✅ good";
    console.log(`  → [${label}] ${outputPath}`);
    return { fileName, autoFixed, blocking };
}
function writeReport(results, reportPath) {
    const now = new Date().toISOString().slice(0, 10);
    const clean = results.filter((r) => r.blocking.length === 0 && r.autoFixed.length === 0);
    const fixed = results.filter((r) => r.blocking.length === 0 && r.autoFixed.length > 0);
    const bad = results.filter((r) => r.blocking.length > 0);
    const lines = [
        `# Звіт перевірки документів`,
        ``,
        `Дата: ${now}`,
        `Всього файлів: ${results.length}`,
        ``,
    ];
    lines.push(`## ✅ Чисті (${clean.length} файлів)`);
    if (clean.length === 0) {
        lines.push(`_—_`);
    }
    else {
        for (const r of clean)
            lines.push(`- ${r.fileName}`);
    }
    lines.push(``);
    lines.push(`## 🔧 Авто-виправлені → good (${fixed.length} файлів)`);
    if (fixed.length === 0) {
        lines.push(`_—_`);
    }
    else {
        for (const r of fixed) {
            lines.push(``, `### ${r.fileName}`);
            for (const issue of r.autoFixed)
                lines.push(`- ${issue}`);
        }
    }
    lines.push(``);
    lines.push(`## ❌ Потребують уваги → bad (${bad.length} файлів)`);
    if (bad.length === 0) {
        lines.push(`_—_`);
    }
    else {
        for (const r of bad) {
            lines.push(``, `### ${r.fileName}`);
            for (const issue of r.blocking)
                lines.push(`- ${issue}`);
            if (r.autoFixed.length > 0) {
                lines.push(`  *(також авто-виправлено ${r.autoFixed.length} рядків)*`);
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
    const results = [];
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
    }
    else {
        results.push(processFile(absArg, goodDir, badDir));
    }
    writeReport(results, reportPath);
    const goodCount = results.filter((r) => r.blocking.length === 0).length;
    const badCount = results.filter((r) => r.blocking.length > 0).length;
    const fixedCount = results.filter((r) => r.blocking.length === 0 && r.autoFixed.length > 0).length;
    console.log(`\n✅ Готово. good: ${goodCount} (з них авто-виправлено: ${fixedCount}), bad: ${badCount}. Оригінали не змінено.\n`);
}
main();
