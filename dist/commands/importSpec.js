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
exports.runImport = runImport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const specParser_1 = require("../parser/specParser");
const creator_1 = require("../bom/creator");
const registry_1 = require("../registry/registry");
const checker_1 = require("../validator/checker");
function extractSofaName(filePath) {
    return path.basename(filePath, '.md');
}
function askQuestion(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer.trim().toLowerCase());
    }));
}
async function runImport(filePath) {
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
    const checkResult = (0, checker_1.checkDocument)(absPath);
    if (!checkResult.valid) {
        console.error(`\n❌ Файл містить ${checkResult.errors.length} помилок — імпорт заблоковано.`);
        console.error('   Запустіть: npm run validate "' + filePath + '"');
        process.exit(1);
    }
    if (checkResult.warnings.length > 0) {
        console.warn(`\n⚠️  ${checkResult.warnings.length} попереджень. Продовжуємо...`);
    }
    // Перевірити реєстр
    const existing = (0, registry_1.getEntry)(sofaName);
    if (existing && existing.status === 'active') {
        console.log(`\n⚠️  "${sofaName}" вже імпортований (${existing.importedAt}).`);
        console.log(`   BOM IDs: [${existing.bomIds.join(', ')}]`);
        const answer = await askQuestion('\n   Оновити? Старі BOM будуть заархівовані [т/н]: ');
        if (answer !== 'т' && answer !== 'y' && answer !== 'yes') {
            console.log('   Імпорт скасовано.');
            return;
        }
        (0, registry_1.archiveEntry)(sofaName);
        console.log('   📦 Попередній запис заархівовано.');
    }
    // Парсинг
    console.log('\n📖 Парсинг специфікації...');
    let boms;
    try {
        boms = (0, specParser_1.parseSpecFile)(absPath);
    }
    catch (err) {
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
    await (0, creator_1.createAllBoms)(boms);
    // Зберегти в реєстр (без bomIds бо creator не повертає їх — TODO)
    (0, registry_1.setEntry)(sofaName, {
        specFile: filePath,
        importedAt: new Date().toISOString().split('T')[0],
        bomIds: [],
        status: 'active',
    });
    console.log(`\n✅ "${sofaName}" успішно імпортовано.`);
}
