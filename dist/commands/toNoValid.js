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
exports.runToNoValid = runToNoValid;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const toNoValid_1 = require("../validator/toNoValid");
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "docs", "documents_no_valid");
async function runToNoValid(filePath, outDirArg) {
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
    const result = (0, toNoValid_1.toNoValidContent)(raw);
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
