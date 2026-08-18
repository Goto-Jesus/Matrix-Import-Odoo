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
exports.runValidate = runValidate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const formatter_1 = require("../validator/formatter");
const checker_1 = require("../validator/checker");
const VALIDATED_DIR = path.resolve(process.cwd(), 'docs', 'validated');
const REFERENCE_PATH = path.resolve(process.cwd(), 'right_names_odoo_base.md');
async function runValidate(filePath) {
    if (!filePath) {
        console.error('Використання: npm run validate <шлях до файлу>');
        console.error('Наприклад:  npm run validate "documents/Диван Нео-3 Колеса.md"');
        process.exit(1);
    }
    const absPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`Файл не знайдено: ${absPath}`);
        process.exit(1);
    }
    const fileName = path.basename(absPath);
    console.log(`\n📄 Файл: ${fileName}`);
    console.log('─'.repeat(50));
    // Крок 1: Авто-форматування
    console.log('\n🔧 Крок 1: Авто-форматування...');
    const formatResult = (0, formatter_1.formatDocument)(absPath);
    if (formatResult.changes.length === 0) {
        console.log('   Змін немає — форматування чисте.');
    }
    else {
        console.log(`   Виправлено ${formatResult.changes.length} проблем:`);
        for (const change of formatResult.changes) {
            console.log(`   • ${change}`);
        }
    }
    // Зберегти відформатований файл
    fs.mkdirSync(VALIDATED_DIR, { recursive: true });
    const outPath = path.join(VALIDATED_DIR, fileName);
    fs.writeFileSync(outPath, formatResult.content, 'utf-8');
    console.log(`\n   ✅ Збережено: ${path.relative(process.cwd(), outPath)}`);
    // Крок 2: Перевірка
    console.log('\n🔍 Крок 2: Перевірка...');
    const checkResult = (0, checker_1.checkDocument)(outPath, REFERENCE_PATH);
    if (checkResult.errors.length === 0 && checkResult.warnings.length === 0) {
        console.log('   ✅ Помилок не знайдено. Файл готовий до імпорту.');
        console.log(`\n   👉 Для імпорту: npm run import "${filePath}"`);
        return;
    }
    // Зберегти звіт
    const reportContent = (0, checker_1.formatCheckReport)(checkResult, absPath);
    const reportPath = outPath.replace(/\.md$/, '.errors.md');
    fs.writeFileSync(reportPath, reportContent, 'utf-8');
    if (checkResult.errors.length > 0) {
        console.log(`\n   ❌ Знайдено ${checkResult.errors.length} помилок:`);
        for (const e of checkResult.errors) {
            console.log(`   • Рядок ${e.line}: ${e.message}`);
            if (e.original)
                console.log(`     "${e.original}"`);
        }
    }
    if (checkResult.warnings.length > 0) {
        console.log(`\n   ⚠️  ${checkResult.warnings.length} попереджень:`);
        for (const w of checkResult.warnings.slice(0, 10)) {
            console.log(`   • Рядок ${w.line}: ${w.message}`);
        }
        if (checkResult.warnings.length > 10) {
            console.log(`   ... та ще ${checkResult.warnings.length - 10} попереджень`);
        }
    }
    console.log(`\n   📋 Повний звіт: ${path.relative(process.cwd(), reportPath)}`);
    if (!checkResult.valid) {
        console.log('\n   ❗ Виправте помилки перед імпортом.');
        console.log('   Для допомоги — відкрийте звіт через AI (Claude).');
    }
    else {
        console.log('\n   ⚠️  Є попередження, але помилок немає.');
        console.log(`   👉 Для імпорту: npm run import "${filePath}"`);
    }
}
